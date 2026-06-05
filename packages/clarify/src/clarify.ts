import {
  CST_OFFSET_MS,
  loadConfig,
  parseAwaitingClarify,
  safeParseOrNull,
  toolErrorSchema,
  type AwaitingClarify,
  type ClarifyItem,
  type ClarifyToolAwaitingResult,
  type ClarifyToolResolvedResult,
  clarifyToolAwaitingResultSchema,
  clarifyToolResolvedResultSchema,
  isSessionMeta,
} from "@freeanima/legacy-kernel";
import { loadSessionMeta, updateSessionMetaField } from "@freeanima/engine-conversation";

export type { ClarifyItem, AwaitingClarify };
export type ClarifyAwaitingResult = ClarifyToolAwaitingResult;
export type ClarifyResolvedResult = ClarifyToolResolvedResult;

export type GuardAwaitingResult =
  | { ok: true; expired?: false }
  | { ok: true; expired: true; hint: string }
  | { ok: false; reason: string };

const DEFAULT_TIMEOUT_SEC = 1800;
const DEFAULT_MAX_ITEMS = 5;

function nowIso(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

function parseAwaiting(raw: unknown): AwaitingClarify | null {
  return parseAwaitingClarify(raw);
}

export function getClarifyConfig(): { timeout_sec: number; max_items: number } {
  const cfg = loadConfig();
  const clarify = cfg.clarify ?? {};
  return {
    timeout_sec:
      typeof clarify.timeout_sec === "number" && clarify.timeout_sec >= 60
        ? clarify.timeout_sec
        : DEFAULT_TIMEOUT_SEC,
    max_items:
      typeof clarify.max_items === "number" && clarify.max_items >= 1
        ? clarify.max_items
        : DEFAULT_MAX_ITEMS,
  };
}

export async function readAwaitingClarify(session: string): Promise<AwaitingClarify | null> {
  const meta = await loadSessionMeta(session);
  if (!isSessionMeta(meta)) return null;
  return parseAwaiting(meta.awaiting_clarify);
}

export async function setAwaitingClarify(
  session: string,
  payload: { items: ClarifyItem[]; timeout_sec: number },
  opts?: { asked_at?: string },
): Promise<void> {
  const awaiting: AwaitingClarify = {
    items: payload.items,
    required: true,
    asked_at: opts?.asked_at ?? nowIso(),
    timeout_sec: payload.timeout_sec,
  };
  await updateSessionMetaField(session, { awaiting_clarify: awaiting });
}

export async function clearAwaitingClarify(session: string): Promise<void> {
  await updateSessionMetaField(session, { awaiting_clarify: undefined });
}

export function isAwaitingClarifyExpired(awaiting: AwaitingClarify): boolean {
  const asked = Date.parse(awaiting.asked_at);
  if (Number.isNaN(asked)) return true;
  return Date.now() > asked + awaiting.timeout_sec * 1000;
}

export async function expireIfNeeded(
  session: string,
): Promise<{ expired: boolean; hint?: string }> {
  const awaiting = await readAwaitingClarify(session);
  if (!awaiting) return { expired: false };
  if (!isAwaitingClarifyExpired(awaiting)) return { expired: false };
  await clearAwaitingClarify(session);
  return { expired: true, hint: "之前的问题已超时作废。" };
}

export function mergeClarifyResponse(items: ClarifyItem[], userText: string): string {
  const lines = ["[The assistant previously asked:]"];
  for (let i = 0; i < items.length; i++) {
    lines.push(`${i + 1}. ${items[i]!.question}`);
  }
  lines.push("[The user responded:]", userText);
  return lines.join("\n");
}

export function formatClarifyText(items: ClarifyItem[]): string {
  const parts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    parts.push(`❓ ${i + 1}. ${item.question}`);
    if (item.choices?.length) {
      for (let j = 0; j < item.choices.length; j++) {
        parts.push(`   ${j + 1}. ${item.choices[j]}`);
      }
    }
  }
  return parts.join("\n");
}

export async function guardAwaitingClarify(
  session: string,
  message: string,
): Promise<GuardAwaitingResult> {
  const expiry = await expireIfNeeded(session);
  if (expiry.expired) {
    return { ok: true, expired: true, hint: expiry.hint ?? "之前的问题已超时作废。" };
  }

  const awaiting = await readAwaitingClarify(session);
  if (!awaiting) return { ok: true };

  const trimmed = message.trim();
  if (/^\/cancel(\s|$)/i.test(trimmed)) return { ok: true };

  if (trimmed.startsWith("/")) {
    return {
      ok: false,
      reason: "请先回答上方问题，或发送 /cancel 取消提问。",
    };
  }

  return { ok: true };
}

export function parseClarifyToolResult(
  content: string,
): ClarifyAwaitingResult | ClarifyResolvedResult | { error: string } | null {
  try {
    const data: unknown = JSON.parse(content);
    const err = safeParseOrNull(toolErrorSchema, data);
    if (err) return { error: err.error };

    const awaiting = safeParseOrNull(clarifyToolAwaitingResultSchema, data);
    if (awaiting) return awaiting;

    const resolved = safeParseOrNull(clarifyToolResolvedResultSchema, data);
    if (resolved) return resolved;

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      (data as { status?: string }).status === "awaiting" &&
      Array.isArray((data as { items?: unknown }).items)
    ) {
      const timeout =
        typeof (data as { timeout_sec?: unknown }).timeout_sec === "number" &&
        (data as { timeout_sec: number }).timeout_sec >= 60
          ? (data as { timeout_sec: number }).timeout_sec
          : getClarifyConfig().timeout_sec;
      const items: ClarifyItem[] = [];
      for (const item of (data as { items: unknown[] }).items) {
        if (!item || typeof item !== "object") continue;
        const q = item as Record<string, unknown>;
        if (typeof q.question !== "string" || !q.question.trim()) continue;
        const out: ClarifyItem = { question: q.question.trim() };
        if (Array.isArray(q.choices)) {
          out.choices = q.choices.filter((c): c is string => typeof c === "string").slice(0, 4);
        }
        if (typeof q.default === "string") out.default = q.default;
        items.push(out);
      }
      if (items.length) return { status: "awaiting", items, timeout_sec: timeout };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function findAwaitingClarifyInMessages(
  messages: Record<string, unknown>[],
): ClarifyAwaitingResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "tool" || msg.name !== "clarify") continue;
    const content = typeof msg.content === "string" ? msg.content : "";
    const parsed = parseClarifyToolResult(content);
    if (parsed && "status" in parsed && parsed.status === "awaiting") return parsed;
  }
  return null;
}

export async function resolveUserContent(session: string, userText: string): Promise<string> {
  const expiry = await expireIfNeeded(session);
  if (expiry.expired) {
    return `${expiry.hint ?? "之前的问题已超时作废。"}\n\n${userText}`;
  }

  const awaiting = await readAwaitingClarify(session);
  if (awaiting) {
    await clearAwaitingClarify(session);
    return mergeClarifyResponse(awaiting.items, userText);
  }
  return userText;
}
