import { randomPublicId } from "@freeanima/shared/util";

import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";
import { getRedis, isRedisConfigured } from "./client.ts";

/** Key 前缀约定：分布式锁 */
export const REDIS_LOCK_KEY_PREFIX = "anima:lock:";

/** 未传 ttlMs 时的持有租约兜底；杀进程后卡死上限 ≈ 此时效（活任务靠 renew 续期） */
export const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10min

const DEFAULT_RETRY_INTERVAL_MS = 150;
const DEFAULT_WAIT_MS = 30_000;

const UNLOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const EXTEND_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

let unavailableWarned = false;
/** Inbox 已 notified/deduped；skipped（port 未就绪）时下次 bypass 再试 */
let softFailureInboxSettled = false;

export type RedisLockAcquireOpts = {
  /** 逻辑名；自动加 `anima:lock:` 前缀 */
  key: string;
  /** 持有租约；省略则 DEFAULT_LOCK_TTL_MS（10min） */
  ttlMs?: number;
  /** 长任务 watchdog 续期 */
  renew?: boolean;
  /** try=立即返回；wait=阻塞重试。默认 try */
  mode?: "try" | "wait";
  /** mode=wait 时的最长等待；默认 30s */
  waitMs?: number;
  /** wait 重试间隔基准；默认 ~150ms，另加小 jitter */
  retryIntervalMs?: number;
  /** 取消等待 */
  signal?: AbortSignal;
};

export type WithRedisLockOpts = RedisLockAcquireOpts;

export type RedisLockHandle = {
  /** 释放锁并停止 watchdog；可安全重复调用 */
  release: () => Promise<void>;
};

export type AcquireRedisLockResult =
  | { status: "ok"; handle: RedisLockHandle }
  /** Redis 未配置：无分布式互斥，仍可继续（local-only） */
  | { status: "ok"; handle: RedisLockHandle; bypassed: true }
  | { status: "busy" };

export type WithRedisLockResult<T> = { status: "ok"; value: T } | { status: "busy" };

function lockKey(logicalKey: string): string {
  if (logicalKey.startsWith(REDIS_LOCK_KEY_PREFIX)) return logicalKey;
  return `${REDIS_LOCK_KEY_PREFIX}${logicalKey}`;
}

function warnUnavailableOnce(): void {
  if (!unavailableWarned) {
    unavailableWarned = true;
    console.warn(
      "[redis-lock] Redis unavailable; distributed locks degraded to local-only. Configure reachable redis for multi-Habitat mutual exclusion.",
    );
  }
  if (softFailureInboxSettled) return;
  void notifySoftFailure({
    sourceRef: cstDaySourceRef("redis:lock_local_bypass"),
    title: "Redis 锁已降级为本地旁路",
    body: [
      "Redis 不可用或未配置，分布式锁已降级为进程内旁路（无跨 Habitat 互斥）。",
      "多实例部署时请配置可达 Redis；单实例可忽略。",
    ].join("\n"),
    payload: { kind: "redis_lock_local_bypass" },
    logLabel: "redis_lock",
  }).then((result) => {
    // skipped = port/impl 未就绪；稍后再试。notified/deduped = 本 CST 日已落盘。
    if (result !== "skipped") softFailureInboxSettled = true;
  });
}

function bypassedLockResult(): Extract<AcquireRedisLockResult, { bypassed: true }> {
  warnUnavailableOnce();
  return {
    status: "ok",
    bypassed: true,
    handle: {
      release: async () => {},
    },
  };
}

/** acquired=拿到锁；held=他人持有；unavailable=连接/命令失败（应降级而非当 busy） */
type AcquireAttempt = "acquired" | "held" | "unavailable";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function retryDelayMs(baseMs: number): number {
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseMs / 3)));
  return baseMs + jitter;
}

async function tryAcquire(key: string, token: string, ttlMs: number): Promise<AcquireAttempt> {
  try {
    // bun-types 的 NX+PX 组合走 ...options: string[]
    const result = await getRedis().set(key, token, "NX", "PX", String(ttlMs));
    return result === "OK" ? "acquired" : "held";
  } catch {
    return "unavailable";
  }
}

async function releaseLock(key: string, token: string): Promise<boolean> {
  try {
    // Bun 1.3.14 typings 尚无 eval；经 send 调 EVAL
    const result: unknown = await getRedis().send("EVAL", [UNLOCK_LUA, "1", key, token]);
    return result === 1 || result === "1";
  } catch {
    return false;
  }
}

async function extendLock(key: string, token: string, ttlMs: number): Promise<boolean> {
  try {
    const result: unknown = await getRedis().send("EVAL", [
      EXTEND_LUA,
      "1",
      key,
      token,
      String(ttlMs),
    ]);
    return result === 1 || result === "1";
  } catch {
    return false;
  }
}

function startWatchdog(key: string, token: string, ttlMs: number): () => void {
  const intervalMs = Math.max(1_000, Math.floor(ttlMs / 3));
  const handle = setInterval(() => {
    void extendLock(key, token, ttlMs);
  }, intervalMs);
  if (typeof handle === "object" && handle && "unref" in handle) {
    (handle as { unref: () => void }).unref?.();
  }
  return () => clearInterval(handle);
}

async function waitForLock(
  key: string,
  token: string,
  ttlMs: number,
  waitMs: number,
  retryIntervalMs: number,
  signal?: AbortSignal,
): Promise<AcquireAttempt> {
  const deadline = Date.now() + waitMs;
  let sawHeld = false;
  while (Date.now() < deadline) {
    if (signal?.aborted) return sawHeld ? "held" : "unavailable";
    const attempt = await tryAcquire(key, token, ttlMs);
    if (attempt === "acquired") return "acquired";
    if (attempt === "unavailable") {
      // 连接失败：立即降级，勿空等 30s 再误报 busy
      return "unavailable";
    }
    sawHeld = true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      await sleep(Math.min(retryDelayMs(retryIntervalMs), remaining), signal);
    } catch {
      return sawHeld ? "held" : "unavailable";
    }
  }
  if (signal?.aborted) return sawHeld ? "held" : "unavailable";
  return tryAcquire(key, token, ttlMs);
}

/**
 * 获取锁句柄（适合 fire-and-forget 长任务：拿到后异步跑，结束再 release）。
 * Redis 未配置时返回 bypassed 空 handle（release 为 no-op）。
 */
export async function acquireRedisLock(
  opts: RedisLockAcquireOpts,
): Promise<AcquireRedisLockResult> {
  if (!isRedisConfigured()) {
    return bypassedLockResult();
  }

  const key = lockKey(opts.key);
  const ttlMs = opts.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const mode = opts.mode ?? "try";
  const token = randomPublicId();

  const attempt =
    mode === "wait"
      ? await waitForLock(
          key,
          token,
          ttlMs,
          opts.waitMs ?? DEFAULT_WAIT_MS,
          opts.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
          opts.signal,
        )
      : await tryAcquire(key, token, ttlMs);

  if (attempt === "unavailable") {
    return bypassedLockResult();
  }
  if (attempt === "held") {
    return { status: "busy" };
  }

  const stopWatchdog = opts.renew ? startWatchdog(key, token, ttlMs) : () => {};
  let released = false;
  return {
    status: "ok",
    handle: {
      release: async () => {
        if (released) return;
        released = true;
        stopWatchdog();
        await releaseLock(key, token);
      },
    },
  };
}

/**
 * 单实例 Redis 锁：SET NX PX + token + Lua 安全释放/续期。
 * 未配置 Redis 时跳过互斥并执行 fn（与现网可选 Redis 一致）。
 */
export async function withRedisLock<T>(
  opts: WithRedisLockOpts,
  fn: () => Promise<T>,
): Promise<WithRedisLockResult<T>> {
  const acquired = await acquireRedisLock(opts);
  if (acquired.status === "busy") {
    return { status: "busy" };
  }
  try {
    return { status: "ok", value: await fn() };
  } finally {
    await acquired.handle.release();
  }
}

export type RedisLockInfo = {
  /** 完整 Redis key（`anima:lock:…`） */
  key: string;
  /** 逻辑名（去掉前缀） */
  logicalKey: string;
  /** 剩余毫秒；-1 表示无过期 */
  ttlMs: number;
};

async function pttlMs(key: string): Promise<number> {
  try {
    const result: unknown = await getRedis().send("PTTL", [key]);
    const n = typeof result === "number" ? result : Number(result);
    return Number.isFinite(n) ? n : -2;
  } catch {
    return -2;
  }
}

/** SCAN `anima:lock:*`；Redis 未配置或失败时返回空数组。 */
export async function listRedisLocks(): Promise<RedisLockInfo[]> {
  if (!isRedisConfigured()) return [];
  const results: RedisLockInfo[] = [];
  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${REDIS_LOCK_KEY_PREFIX}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      for (const key of keys) {
        const ttlMs = await pttlMs(key);
        if (ttlMs === -2) continue;
        results.push({
          key,
          logicalKey: key.startsWith(REDIS_LOCK_KEY_PREFIX)
            ? key.slice(REDIS_LOCK_KEY_PREFIX.length)
            : key,
          ttlMs,
        });
      }
    } while (cursor !== "0");
  } catch {
    return [];
  }
  return results;
}

/**
 * 运维强制删锁（无 token 校验）。接受逻辑名或完整 `anima:lock:…`。
 * Redis 未配置或失败时返回 false。
 */
export async function forceReleaseRedisLock(key: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const fullKey = lockKey(key);
  try {
    const deleted = await getRedis().del(fullKey);
    return deleted > 0;
  } catch {
    return false;
  }
}

/** @internal 单测重置 warn-once */
export function resetRedisLockWarnForTest(): void {
  unavailableWarned = false;
}
