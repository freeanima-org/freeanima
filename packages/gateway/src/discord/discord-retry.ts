import { isTransientNetworkError } from "@freeanima/engine-loop";
import { logComponent } from "@freeanima/legacy-kernel";

const DEFAULT_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

/** 从 discord.js / REST 错误提取 HTTP status 与 Discord API code（如 50005） */
export function discordErrorDetails(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return {};
  const rec = err as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const status = errorStatus(err);
  if (status != null) out.http_status = status;
  const code = rec.code;
  if (typeof code === "number" || typeof code === "string") out.discord_code = code;
  const message = rec.message;
  if (typeof message === "string" && message) out.discord_message = message;
  return out;
}

/** Discord REST / 网关瞬态错误（含 429、5xx、底层网络） */
export function isDiscordRetryableError(err: unknown): boolean {
  if (isTransientNetworkError(err)) return true;
  const status = errorStatus(err);
  if (status === 429) return true;
  if (status != null && status >= 500 && status <= 599) return true;
  return false;
}

function discordRetryDelayMs(err: unknown, attempt: number): number {
  if (err && typeof err === "object") {
    const raw =
      (err as { retryAfter?: unknown }).retryAfter ??
      (err as { retry_after?: unknown }).retry_after;
    const sec = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(MAX_BACKOFF_MS, Math.ceil(sec * 1000) + 200);
    }
  }
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
}

export async function withDiscordRetry<T>(
  fn: () => Promise<T>,
  attempts = DEFAULT_ATTEMPTS,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isDiscordRetryableError(e) || i >= attempts - 1) throw e;
      await sleep(discordRetryDelayMs(e, i));
    }
  }
  throw last;
}

/** 流式中间态：尽力 edit，失败只记日志不抛（避免打断后续 flush） */
export async function tryDiscordInterimEdit(
  edit: () => Promise<void>,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await withDiscordRetry(edit);
  } catch (e) {
    logComponent("discord").error("Discord interim edit failed", {
      err: e,
      ...discordErrorDetails(e),
      ...context,
      phase: "interim",
    });
  }
}

/** 最终交付：edit 失败则 fallback 新发一条（避免卡在「思考中」） */
export async function deliverDiscordFinalContent(
  edit: () => Promise<void>,
  sendFallback: () => Promise<void>,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await withDiscordRetry(edit);
  } catch (e) {
    logComponent("discord").error("Discord final edit failed, sending fallback message", {
      err: e,
      ...discordErrorDetails(e),
      ...context,
      phase: "final",
    });
    await withDiscordRetry(sendFallback);
  }
}
