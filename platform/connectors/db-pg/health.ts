import { sql as drizzleSql } from "drizzle-orm";
import { getDb, isPostgresPrimary } from "./client.ts";

const PING_TIMEOUT_MS = 2000;

export type DatabasePingStatus =
  | { status: "connected"; latency_ms?: number }
  | { status: "error"; error?: string }
  | { status: "not_configured" };

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]").slice(0, 200);
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

/** Probe PostgreSQL connectivity (SELECT 1, 2s timeout) */
export async function pingDatabase(): Promise<DatabasePingStatus> {
  if (!isPostgresPrimary()) {
    return { status: "not_configured" };
  }
  const started = Date.now();
  try {
    const db = getDb();
    await withTimeout(db.execute(drizzleSql`SELECT 1`), PING_TIMEOUT_MS);
    return { status: "connected", latency_ms: Date.now() - started };
  } catch (err) {
    return { status: "error", error: sanitizeError(err) };
  }
}
