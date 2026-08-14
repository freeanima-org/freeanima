import { isTransientNetworkError } from "@freeanima/habitat/kernel/loop-mechanism";
import { logComponent } from "@freeanima/habitat/platform/logging";

const DEFAULT_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

/** Extract HTTP status and Discord API code from discord.js / REST errors (e.g. 50005) */
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

/** Discord REST / gateway transient errors (429, 5xx, underlying network) */
export function isDiscordRetryableError(err: unknown): boolean {
  if (isTransientNetworkError(err)) return true;
  const status = errorStatus(err);
  if (status === 429) return true;
  if (status != null && status >= 500 && status <= 599) return true;
  return false;
}

/** Another handler already sent the initial interaction response */
export function isDiscordInteractionAlreadyAcked(err: unknown): boolean {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (code === 40060) return true;
  }
  return false;
}

/** Expired slash interaction token or missing message edit permission during shutdown */
export function isDiscordDeliveryDegraded(err: unknown): boolean {
  if (isDiscordRetryableError(err)) return false;
  const status = errorStatus(err);
  if (status === 403) return true;
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (code === 10062) return true;
    if (code === 40060) return true;
  }
  return false;
}

function logDiscordDeliveryFailure(
  level: "warn" | "error",
  message: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const log = logComponent("discord");
  const payload = { err, ...discordErrorDetails(err), ...context };
  if (level === "warn") {
    log.warn(message, payload);
  } else {
    log.error(message, payload);
  }
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

/** Streaming interim: best-effort edit, log failure without throw (avoid interrupting flush) */
export async function tryDiscordInterimEdit(
  edit: () => Promise<void>,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await withDiscordRetry(edit);
  } catch (e) {
    logDiscordDeliveryFailure(
      isDiscordDeliveryDegraded(e) ? "warn" : "error",
      "Discord interim edit failed",
      e,
      { ...context, phase: "interim" },
    );
  }
}

/** Final delivery: fallback new message if edit fails (avoid stuck on thinking) */
export async function deliverDiscordFinalContent(
  edit: () => Promise<void>,
  sendFallback: () => Promise<void>,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await withDiscordRetry(edit);
  } catch (e) {
    logDiscordDeliveryFailure(
      isDiscordDeliveryDegraded(e) ? "warn" : "error",
      "Discord final edit failed, sending fallback message",
      e,
      { ...context, phase: "final" },
    );
    await withDiscordRetry(sendFallback);
  }
}
