import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHomeDir } from "@freeanima/service-config";
import { isSessionMeta, l2LineSchema, type SessionMessage } from "@freeanima/kernel-schemas";
import { parseJsonLine } from "@freeanima/kernel-schemas";
import { getKernel } from "@freeanima/kernel";

export function processedDir(): string {
  return join(getHomeDir(), "processed");
}

export function l2SessionPath(sessionId: string): string {
  return join(processedDir(), `${sessionId}.jsonl`);
}

function ensureDir(): void {
  mkdirSync(processedDir(), { recursive: true });
}

function loadJsonl(path: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  try {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const parsed = parseJsonLine(line, l2LineSchema);
      if (parsed) records.push(parsed);
    }
  } catch {
    /* empty */
  }
  return records;
}

async function readSessionMetaForDistill(sessionId: string): Promise<{
  platform?: string;
  platform_extra?: Record<string, unknown>;
  title?: string;
}> {
  if (!getKernel().repos.pgAvailable) return {};
  const meta = await getKernel().repos.session.getSessionMeta(sessionId);
  if (!meta || !isSessionMeta(meta)) return {};
  return {
    platform: meta.platform != null ? String(meta.platform) : undefined,
    platform_extra:
      meta.platform_extra && typeof meta.platform_extra === "object"
        ? (meta.platform_extra as Record<string, unknown>)
        : undefined,
    title: meta.title != null ? String(meta.title) : undefined,
  };
}

function messagesToRecords(msgs: SessionMessage[]): Record<string, unknown>[] {
  return msgs.map((m) => ({ ...m }) as Record<string, unknown>);
}

function l1ActivityMtimeMs(records: Record<string, unknown>[]): number | null {
  let max = 0;
  for (const rec of records) {
    const role = rec.role;
    if (role !== "user" && role !== "assistant") continue;
    const ts = String(rec.timestamp ?? "");
    const t = Date.parse(ts);
    if (!Number.isNaN(t) && t > max) max = t;
  }
  const meta = records.find((r) => r.role === "session_meta");
  if (meta?.timestamp) {
    const t = Date.parse(String(meta.timestamp));
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max > 0 ? max : null;
}

async function extractMeta(
  records: Record<string, unknown>[],
  sessionId: string,
): Promise<Record<string, unknown>> {
  const meta: Record<string, unknown> = {
    type: "meta",
    session_id: sessionId,
    title: "",
    created: "",
    last_time: "",
    platform: "",
    platform_extra: {},
  };

  const sm = await readSessionMetaForDistill(sessionId);
  if (sm.platform) meta.platform = sm.platform;
  if (sm.platform_extra) meta.platform_extra = sm.platform_extra;
  if (sm.title) meta.title = sm.title;

  for (const rec of records) {
    if (rec.role === "session_meta") {
      meta.session_id = String(rec.session ?? rec.session_id ?? sessionId) || sessionId;
      if (!meta.platform && rec.platform) meta.platform = rec.platform;
      if (rec.platform_extra) meta.platform_extra = rec.platform_extra;
      if (!meta.title && rec.title) meta.title = rec.title;
      break;
    }
  }

  const timestamps: string[] = [];
  for (const rec of records) {
    const role = rec.role;
    if (role === "user" || role === "assistant") {
      const ts = String(rec.timestamp ?? "");
      if (ts) timestamps.push(ts);
    }
  }
  if (timestamps.length) {
    timestamps.sort();
    meta.created = timestamps[0];
    meta.last_time = timestamps[timestamps.length - 1];
  }

  if (!meta.title) {
    for (const rec of records) {
      if (rec.role === "user") {
        const content = String(rec.content ?? "").trim();
        if (content) {
          meta.title = content.slice(0, 30);
          break;
        }
      }
    }
  }

  return meta;
}

function extractMessages(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [];
  for (const rec of records) {
    const role = rec.role;
    if (role !== "user" && role !== "assistant") continue;
    const content = rec.content;
    if (!content || !String(content).trim()) {
      if (role === "assistant" && rec.tool_calls) continue;
      continue;
    }
    messages.push({
      t: rec.timestamp ?? "",
      role,
      content: String(content).trim(),
    });
  }
  return messages;
}

async function writeL2FromRecords(
  sessionId: string,
  records: Record<string, unknown>[],
  opts?: { overwrite?: boolean; ifNewer?: boolean },
): Promise<string | null> {
  ensureDir();
  const out = l2SessionPath(sessionId);
  const overwrite = opts?.overwrite ?? false;
  const ifNewer = opts?.ifNewer ?? false;

  if (existsSync(out) && !overwrite) {
    if (ifNewer) {
      const l1M = l1ActivityMtimeMs(records);
      if (l1M == null) return null;
      const l2M = statSync(out).mtimeMs;
      if (l1M <= l2M) return null;
    } else {
      return null;
    }
  }

  if (!records.length) return null;

  const metaRecord = await extractMeta(records, sessionId);
  const messages = extractMessages(records);
  if (!messages.length) return null;

  const lines = [JSON.stringify(metaRecord), ...messages.map((m) => JSON.stringify(m))];
  writeFileSync(out, `${lines.join("\n")}\n`, "utf-8");
  return out;
}

/** 从 PostgreSQL L1 蒸馏为 L2 JSONL */
export async function distillFromPg(
  sessionId: string,
  opts?: { overwrite?: boolean; ifNewer?: boolean },
): Promise<string | null> {
  if (!getKernel().repos.pgAvailable) return null;
  const msgs = await getKernel().repos.session.listMessages(sessionId);
  if (!msgs.length) return null;
  const records = messagesToRecords(msgs);
  return writeL2FromRecords(sessionId, records, opts);
}

/**
 * @deprecated 离线脚本；运行时请用 distillFromPg
 */
export async function distill(
  sessionId: string,
  l1Path: string,
  opts?: { overwrite?: boolean; ifNewer?: boolean },
): Promise<string | null> {
  if (!existsSync(l1Path)) return null;
  const records = loadJsonl(l1Path);
  return writeL2FromRecords(sessionId, records, opts);
}

/** 扫描 PG 中全部 session，批量蒸馏为 L2 */
export async function distillAll(opts?: { overwrite?: boolean }): Promise<number> {
  const overwrite = opts?.overwrite ?? false;
  let count = 0;
  if (!getKernel().repos.pgAvailable) return 0;
  for (const sid of await getKernel().repos.session.listSessionIds(null)) {
    if ((await distillFromPg(sid, { overwrite })) !== null) count++;
  }
  return count;
}
