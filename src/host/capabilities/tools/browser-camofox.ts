import { toolError, toolResult } from "@freeanima/host/core/tool";
import type { Config } from "@freeanima/host/core/config";
import { homePath } from "@freeanima/host/core/config";
import { omitUndefined } from "@freeanima/host/core/util";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const DEFAULT_TIMEOUT_MS = 30_000;
const NAVIGATE_TIMEOUT_MS = 60_000;
const SNAPSHOT_SUMMARIZE_THRESHOLD = 8_000;
const SNAPSHOT_MAX_CHARS = 80_000;

export type CamofoxSession = {
  userId: string;
  tabId: string | null;
  sessionKey: string;
  managed: boolean;
  adoptExistingTab: boolean;
};

type CamofoxConfig = {
  baseUrl: string;
  timeoutMs: number;
  managedPersistence: boolean;
  adoptExistingTab: boolean;
  userId?: string;
  sessionKey?: string;
};

const sessions = new Map<string, CamofoxSession>();
let vncUrl: string | null = null;
let vncUrlChecked = false;
let browserConfig: Config | null = null;

export function bindBrowserToolsConfig(config: Config): void {
  browserConfig = config;
}

export function resetBrowserToolsConfigForTest(): void {
  browserConfig = null;
}

function getCamofoxConfigBlock(): Record<string, unknown> {
  try {
    if (!browserConfig) return {};
    const cfg = browserConfig.data as Record<string, unknown>;
    const browser = cfg.browser as Record<string, unknown> | undefined;
    const camofox = browser?.camofox;
    return typeof camofox === "object" && camofox != null && !Array.isArray(camofox)
      ? (camofox as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getCamofoxUrl(): string {
  const block = getCamofoxConfigBlock();
  const fromCfg = typeof block.base_url === "string" ? block.base_url.trim() : "";
  return fromCfg.replace(/\/$/, "");
}

export function isCamofoxConfigured(): boolean {
  return Boolean(getCamofoxUrl());
}

function resolveConfig(): CamofoxConfig {
  const block = getCamofoxConfigBlock();
  const timeoutRaw = block.timeout_ms;
  const timeoutMs =
    typeof timeoutRaw === "number" && timeoutRaw > 0 ? timeoutRaw : DEFAULT_TIMEOUT_MS;
  return omitUndefined({
    baseUrl: getCamofoxUrl(),
    timeoutMs,
    // unset → true（与设置页一致）；显式 false 才关闭
    managedPersistence: block.managed_persistence !== false,
    adoptExistingTab: block.adopt_existing_tab !== false,
    userId: typeof block.user_id === "string" ? block.user_id.trim() : undefined,
    sessionKey: typeof block.session_key === "string" ? block.session_key.trim() : undefined,
  });
}

function digest(prefix: string, input: string, len: number): string {
  return createHash("sha256").update(`${prefix}:${input}`).digest("hex").slice(0, len);
}

function getCamofoxIdentity(conversationId: string): { userId: string; sessionKey: string } {
  const scopeRoot = homePath("browser_auth", "camofox");
  const userDigest = digest("camofox-user", scopeRoot, 10);
  const sessionDigest = digest("camofox-session", `${scopeRoot}:${conversationId}`, 16);
  return {
    userId: `anima_${userDigest}`,
    sessionKey: `task_${sessionDigest}`,
  };
}

function identityOverride(
  conversationId: string,
  cfg: CamofoxConfig,
): { userId: string; sessionKey: string } | null {
  const userId = cfg.userId?.trim() ?? "";
  if (!userId) return null;
  const sessionKey = cfg.sessionKey?.trim() || `task_${conversationId.slice(0, 16)}`;
  return { userId, sessionKey };
}

async function camofoxFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const cfg = resolveConfig();
  if (!cfg.baseUrl) {
    throw new Error(
      "Camofox not configured. Set browser.camofox.base_url in Habitat 服务配置（runtime）。",
    );
  }
  const timeoutMs = init.timeoutMs ?? cfg.timeoutMs;
  const { timeoutMs: _drop, ...rest } = init;
  const resp = await fetch(`${cfg.baseUrl}${path}`, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Camofox HTTP ${resp.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return resp;
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const resp = await camofoxFetch(
    path,
    omitUndefined({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs,
    }),
  );
  return (await resp.json()) as Record<string, unknown>;
}

async function getJson(
  path: string,
  params?: Record<string, string>,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const url = new URL(`${resolveConfig().baseUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const resp = await camofoxFetch(
    url.pathname + url.search,
    omitUndefined({ method: "GET", timeoutMs }),
  );
  return (await resp.json()) as Record<string, unknown>;
}

async function deleteJson(path: string, timeoutMs?: number): Promise<Record<string, unknown>> {
  const resp = await camofoxFetch(path, omitUndefined({ method: "DELETE", timeoutMs }));
  if (resp.status === 204) return {};
  return (await resp.json()) as Record<string, unknown>;
}

async function getRaw(
  path: string,
  params?: Record<string, string>,
  timeoutMs?: number,
): Promise<ArrayBuffer> {
  const url = new URL(`${resolveConfig().baseUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const resp = await camofoxFetch(
    url.pathname + url.search,
    omitUndefined({ method: "GET", timeoutMs }),
  );
  return resp.arrayBuffer();
}

export async function checkCamofoxAvailable(): Promise<boolean> {
  const url = getCamofoxUrl();
  if (!url) return false;
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5_000) });
    if (resp.status === 200 && !vncUrlChecked) {
      try {
        const data = (await resp.json()) as Record<string, unknown>;
        const vncPort = data.vncPort;
        if (typeof vncPort === "number" && vncPort >= 1 && vncPort <= 65535) {
          const parsed = new URL(url);
          const host = parsed.hostname || "localhost";
          vncUrl = `http://${host}:${vncPort}`;
        }
      } catch {
        /* ignore */
      }
      vncUrlChecked = true;
    }
    return resp.status === 200;
  } catch {
    return false;
  }
}

export function getVncUrl(): string | null {
  return vncUrl;
}

function truncateSnapshot(snapshotText: string, maxChars = SNAPSHOT_SUMMARIZE_THRESHOLD): string {
  if (snapshotText.length <= maxChars) return snapshotText;
  const lines = snapshotText.split("\n");
  const result: string[] = [];
  let chars = 0;
  for (const line of lines) {
    if (chars + line.length + 1 > maxChars - 120) break;
    result.push(line);
    chars += line.length + 1;
  }
  const remaining = lines.length - result.length;
  if (remaining > 0) {
    result.push(
      `\n[truncated: ${remaining} lines omitted (${snapshotText.length} chars total); use browser_snapshot(full=true) for full content]`,
    );
  }
  return result.join("\n");
}

async function adoptExistingTab(session: CamofoxSession): Promise<CamofoxSession> {
  if (session.tabId || !session.adoptExistingTab || !getCamofoxUrl()) return session;
  try {
    const data = await getJson("/tabs", { userId: session.userId }, 5_000);
    const tabs = data.tabs;
    if (!Array.isArray(tabs) || tabs.length === 0) return session;
    const matching = tabs.filter(
      (tab): tab is Record<string, unknown> =>
        typeof tab === "object" && tab != null && tab.listItemId === session.sessionKey,
    );
    const candidates =
      matching.length > 0
        ? matching
        : tabs.filter(
            (tab): tab is Record<string, unknown> => typeof tab === "object" && tab != null,
          );
    const latest = candidates.at(-1);
    const tabId = latest?.tabId;
    if (typeof tabId === "string" && tabId) {
      session.tabId = tabId;
    }
  } catch {
    /* best effort */
  }
  return session;
}

function getSession(conversationId: string): CamofoxSession {
  const existing = sessions.get(conversationId);
  if (existing) return existing;

  const cfg = resolveConfig();
  const override = identityOverride(conversationId, cfg);
  let session: CamofoxSession;
  if (override) {
    session = {
      userId: override.userId,
      tabId: null,
      sessionKey: override.sessionKey,
      managed: true,
      adoptExistingTab: cfg.adoptExistingTab,
    };
  } else if (cfg.managedPersistence) {
    const identity = getCamofoxIdentity(conversationId);
    session = {
      userId: identity.userId,
      tabId: null,
      sessionKey: identity.sessionKey,
      managed: true,
      adoptExistingTab: cfg.adoptExistingTab,
    };
  } else {
    session = {
      userId: `anima_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
      tabId: null,
      sessionKey: `task_${conversationId.slice(0, 16)}`,
      managed: false,
      adoptExistingTab: false,
    };
  }
  sessions.set(conversationId, session);
  return session;
}

async function ensureSession(conversationId: string): Promise<CamofoxSession> {
  const session = await adoptExistingTab(getSession(conversationId));
  sessions.set(conversationId, session);
  return session;
}

async function ensureTab(conversationId: string, url = "about:blank"): Promise<CamofoxSession> {
  const session = await ensureSession(conversationId);
  if (session.tabId) return session;
  const data = await postJson("/tabs", {
    userId: session.userId,
    sessionKey: session.sessionKey,
    url,
  });
  const tabId = data.tabId;
  if (typeof tabId !== "string" || !tabId) {
    throw new Error("Camofox tab creation failed: response missing tabId");
  }
  session.tabId = tabId;
  sessions.set(conversationId, session);
  return session;
}

function requireTab(conversationId: string): CamofoxSession {
  const session = sessions.get(conversationId);
  if (!session?.tabId) {
    throw new Error("No browser session. Call browser_navigate first.");
  }
  return session;
}

function connectionErrorMessage(): string {
  const url = getCamofoxUrl() || "http://localhost:9377";
  return (
    `Cannot connect to Camofox (${url}). Ensure Docker is running, e.g.:` +
    `docker run -p 9377:9377 -e CAMOFOX_PORT=9377 jo-inc/camofox-browser`
  );
}

function wrapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("abort") ||
    msg.includes("timeout")
  ) {
    return toolError(connectionErrorMessage());
  }
  return toolError(msg);
}

/** For tests: clear in-process conversation cache */
export function resetCamofoxSessionsForTests(): void {
  sessions.clear();
  vncUrl = null;
  vncUrlChecked = false;
}

export async function camofoxNavigate(conversationId: string, url: string): Promise<string> {
  if (!isCamofoxConfigured()) {
    return toolError(
      "Camofox not configured. Set browser.camofox.base_url in Habitat 服务配置（runtime）。",
    );
  }
  try {
    let session = await ensureSession(conversationId);
    let data: Record<string, unknown>;
    if (!session.tabId) {
      session = await ensureTab(conversationId, url);
      data = { ok: true, url };
    } else {
      data = await postJson(
        `/tabs/${session.tabId}/navigate`,
        { userId: session.userId, url },
        NAVIGATE_TIMEOUT_MS,
      );
    }

    const result: Record<string, unknown> = {
      success: true,
      url: data.url ?? url,
      title: data.title ?? "",
    };
    const vnc = getVncUrl();
    if (vnc) {
      result.vnc_url = vnc;
      result.vnc_hint = "Browser viewable via VNC; share vnc_url with your partner.";
    }

    try {
      const snap = await getJson(`/tabs/${session.tabId}/snapshot`, { userId: session.userId });
      let snapshotText = String(snap.snapshot ?? "");
      if (snapshotText.length > SNAPSHOT_SUMMARIZE_THRESHOLD) {
        snapshotText = truncateSnapshot(snapshotText);
      }
      result.snapshot = snapshotText;
      result.element_count = snap.refsCount ?? 0;
    } catch {
      /* navigate succeeded */
    }

    return toolResult(result);
  } catch (err) {
    return wrapError(err);
  }
}

export async function camofoxSnapshot(conversationId: string, full = false): Promise<string> {
  if (!isCamofoxConfigured()) {
    return toolError(
      "Camofox not configured. Set browser.camofox.base_url in Habitat 服务配置（runtime）。",
    );
  }
  try {
    const session = requireTab(conversationId);
    const data = await getJson(`/tabs/${session.tabId}/snapshot`, { userId: session.userId });
    let snapshot = String(data.snapshot ?? "");
    const refsCount = data.refsCount ?? 0;
    if (!full && snapshot.length > SNAPSHOT_SUMMARIZE_THRESHOLD) {
      snapshot = truncateSnapshot(snapshot);
    } else if (full && snapshot.length > SNAPSHOT_MAX_CHARS) {
      snapshot = truncateSnapshot(snapshot, SNAPSHOT_MAX_CHARS);
    }
    return toolResult({
      success: true,
      snapshot,
      element_count: refsCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxClick(conversationId: string, ref: string): Promise<string> {
  try {
    const session = requireTab(conversationId);
    const cleanRef = ref.replace(/^@+/, "");
    const data = await postJson(`/tabs/${session.tabId}/click`, {
      userId: session.userId,
      ref: cleanRef,
    });
    return toolResult({
      success: true,
      clicked: cleanRef,
      url: data.url ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxType(
  conversationId: string,
  ref: string,
  text: string,
  opts?: { redactTyped?: boolean },
): Promise<string> {
  try {
    const session = requireTab(conversationId);
    const cleanRef = ref.replace(/^@+/, "");
    await postJson(`/tabs/${session.tabId}/type`, {
      userId: session.userId,
      ref: cleanRef,
      text,
    });
    return toolResult({
      success: true,
      typed: opts?.redactTyped === true ? "***" : text,
      element: cleanRef,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxScroll(conversationId: string, direction: string): Promise<string> {
  if (direction !== "up" && direction !== "down") {
    return toolError(`Invalid direction '${direction}'; use up or down.`);
  }
  try {
    const session = requireTab(conversationId);
    const repeats = 5;
    for (let i = 0; i < repeats; i++) {
      await postJson(`/tabs/${session.tabId}/scroll`, {
        userId: session.userId,
        direction,
      });
    }
    return toolResult({ success: true, scrolled: direction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxBack(conversationId: string): Promise<string> {
  try {
    const session = requireTab(conversationId);
    const data = await postJson(`/tabs/${session.tabId}/back`, { userId: session.userId });
    return toolResult({ success: true, url: data.url ?? "" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxPress(conversationId: string, key: string): Promise<string> {
  try {
    const session = requireTab(conversationId);
    await postJson(`/tabs/${session.tabId}/press`, { userId: session.userId, key });
    return toolResult({ success: true, pressed: key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxConsole(_conversationId: string, _clear = false): Promise<string> {
  return toolResult({
    success: true,
    habitat_messages: [],
    js_errors: [],
    total_messages: 0,
    total_errors: 0,
    note: "Camofox backend does not support browser console log capture yet. Use browser_snapshot or browser_vision to inspect the page.",
  });
}

export async function camofoxGetImages(conversationId: string): Promise<string> {
  try {
    const session = requireTab(conversationId);
    const data = await getJson(`/tabs/${session.tabId}/snapshot`, { userId: session.userId });
    const snapshot = String(data.snapshot ?? "");
    const images: Array<{ src: string; alt: string }> = [];
    const lines = snapshot.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const stripped = line.trim();
      if (!stripped.startsWith("- img ") && !stripped.startsWith("img ")) continue;
      const altMatch = /img\s+"([^"]*)"/.exec(stripped);
      const alt = altMatch?.[1] ?? "";
      let src = "";
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const urlMatch = nextLine ? /\/url:\s*(\S+)/.exec(nextLine.trim()) : null;
        if (urlMatch?.[1]) src = urlMatch[1];
      }
      if (alt || src) images.push({ src, alt });
    }
    return toolResult({ success: true, images, count: images.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxVision(
  conversationId: string,
  question: string,
  annotate = false,
): Promise<string> {
  if (!question.trim()) return toolError("question is required");
  try {
    const session = requireTab(conversationId);
    const png = await getRaw(`/tabs/${session.tabId}/screenshot`, { userId: session.userId });
    const dir = homePath("browser_screenshots");
    mkdirSync(dir, { recursive: true });
    const screenshotPath = `${dir}/browser_screenshot_${randomUUID().slice(0, 8)}.png`;
    writeFileSync(screenshotPath, Buffer.from(png));

    const payload: Record<string, unknown> = {
      success: true,
      screenshot_path: screenshotPath,
      question,
      analysis: null,
      note: "Free Anima has no auxiliary vision LLM yet; screenshot saved to screenshot_path. Share the path with your partner or enable vision analysis in a future version.",
    };

    if (annotate) {
      try {
        const snap = await getJson(`/tabs/${session.tabId}/snapshot`, { userId: session.userId });
        const excerpt = String(snap.snapshot ?? "").slice(0, 3000);
        payload.snapshot_excerpt = excerpt;
      } catch {
        /* optional */
      }
    }

    return toolResult(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No browser session")) return toolError(msg);
    return wrapError(err);
  }
}

export async function camofoxClose(conversationId: string): Promise<string> {
  const session = sessions.get(conversationId);
  if (!session) {
    return toolResult({ success: true, closed: true });
  }
  sessions.delete(conversationId);
  try {
    await deleteJson(`/sessions/${session.userId}`);
    return toolResult({ success: true, closed: true });
  } catch (err) {
    return toolResult({
      success: true,
      closed: true,
      warning: err instanceof Error ? err.message : String(err),
    });
  }
}
