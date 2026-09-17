import { getRedis, isRedisConfigured } from "./client.ts";

const PING_TIMEOUT_MS = 2000;

export type RedisPingStatus =
  | { status: "connected"; latency_ms?: number }
  | { status: "error"; error?: string }
  | { status: "not_configured" };

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/redis:\/\/\S+/gi, "[redacted]").slice(0, 200);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Probe Redis connectivity (PING, 2s timeout) */
export async function pingRedis(): Promise<RedisPingStatus> {
  if (!isRedisConfigured()) {
    return { status: "not_configured" };
  }
  const started = Date.now();
  try {
    const pong = await withTimeout(getRedis().ping(), PING_TIMEOUT_MS);
    if (pong !== "PONG") {
      return { status: "error", error: `Unexpected response: ${String(pong)}` };
    }
    return { status: "connected", latency_ms: Date.now() - started };
  } catch (err) {
    return { status: "error", error: sanitizeError(err) };
  }
}
