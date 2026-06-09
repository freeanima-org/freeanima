import { RedisClient } from "bun";
import type { DispatchOutcome, EventQueueAdapter, StoredEvent } from "@freeanima/kernel-eventbus";

const DEFAULT_KEY_PREFIX = "anima:events";
const DEFAULT_BLOCK_SEC = 1;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_POLL_MS = 50;

export type RedisEventQueueOptions = {
  keyPrefix?: string;
  blockSec?: number;
  maxRetries?: number;
  /** BRPOPLPUSH 超时返回 null 时的轮询间隔（毫秒）；默认 50 */
  pollMs?: number;
};

type EventEnvelope = {
  id: number;
  topicQualifiedId: string;
  payload: unknown;
  retries: number;
  createdAt: string;
};

function isRedisConnectionClosedError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: unknown }).code === "ERR_REDIS_CONNECTION_CLOSED"
  );
}

/** 关闭自管 Redis 连接；BRPOPLPUSH 阻塞中被 close 打断时 Bun 可能已关闭连接 */
export function safeCloseOwnedRedisClient(client: RedisClient): void {
  try {
    client.close();
  } catch (err) {
    if (isRedisConnectionClosedError(err)) return;
    throw err;
  }
}

function parseEnvelope(raw: string): EventEnvelope | null {
  try {
    const data = JSON.parse(raw) as EventEnvelope;
    if (
      typeof data.id !== "number" ||
      typeof data.topicQualifiedId !== "string" ||
      typeof data.retries !== "number"
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Redis 持久化事件队列（Bun RedisClient + BRPOPLPUSH）；start 内 resetStuck + 阻塞消费 */
export class RedisEventQueue implements EventQueueAdapter {
  private readonly redis: RedisClient;
  private readonly ownsClient: boolean;
  private readonly keys: { pending: string; processing: string; id: string };
  private readonly blockSec: number;
  private readonly maxRetries: number;
  private readonly pollMs: number;
  private running = false;
  private process: ((event: StoredEvent) => Promise<DispatchOutcome>) | null = null;

  constructor(urlOrClient: string | RedisClient, opts?: RedisEventQueueOptions) {
    if (typeof urlOrClient === "string") {
      this.redis = new RedisClient(urlOrClient);
      this.ownsClient = true;
    } else {
      this.redis = urlOrClient;
      this.ownsClient = false;
    }
    const prefix = opts?.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.keys = {
      pending: `${prefix}:pending`,
      processing: `${prefix}:processing`,
      id: `${prefix}:id`,
    };
    this.blockSec = opts?.blockSec ?? DEFAULT_BLOCK_SEC;
    this.maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.pollMs = opts?.pollMs ?? DEFAULT_POLL_MS;
  }

  enqueue(topicQualifiedId: string, payload: unknown): void {
    void this.enqueueAsync(topicQualifiedId, payload);
  }

  start(process: (event: StoredEvent) => Promise<DispatchOutcome>): void {
    if (this.running) return;
    this.process = process;
    this.running = true;
    void this.bootstrap();
  }

  stop(): void {
    this.running = false;
    if (this.ownsClient) {
      safeCloseOwnedRedisClient(this.redis);
    }
  }

  private async enqueueAsync(topicQualifiedId: string, payload: unknown): Promise<void> {
    const id = await this.redis.incr(this.keys.id);
    const envelope: EventEnvelope = {
      id,
      topicQualifiedId,
      payload,
      retries: 0,
      createdAt: new Date().toISOString(),
    };
    await this.redis.lpush(this.keys.pending, JSON.stringify(envelope));
  }

  private async bootstrap(): Promise<void> {
    await this.resetStuck();
    await this.consumeLoop();
  }

  private async resetStuck(): Promise<void> {
    const items = await this.redis.lrange(this.keys.processing, 0, -1);
    if (!items.length) return;
    await this.redis.del(this.keys.processing);
    for (const raw of items) {
      const envelope = parseEnvelope(raw);
      if (!envelope) continue;
      envelope.retries += 1;
      await this.redis.lpush(this.keys.pending, JSON.stringify(envelope));
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      const raw = await this.redis.brpoplpush(
        this.keys.pending,
        this.keys.processing,
        this.blockSec,
      );
      if (!this.running || !this.process) continue;
      if (!raw) {
        await new Promise((r) => setTimeout(r, this.pollMs));
        continue;
      }
      await this.dispatch(raw);
    }
  }

  private async dispatch(raw: string): Promise<void> {
    const envelope = parseEnvelope(raw);
    if (!envelope) {
      await this.redis.lrem(this.keys.processing, 1, raw);
      return;
    }

    const stored: StoredEvent = {
      id: envelope.id,
      topicQualifiedId: envelope.topicQualifiedId,
      payload: envelope.payload,
    };

    try {
      const outcome = await this.process!(stored);
      await this.applyOutcome(raw, envelope, outcome, null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.applyOutcome(raw, envelope, "retry", msg);
    }
  }

  private async applyOutcome(
    raw: string,
    envelope: EventEnvelope,
    outcome: DispatchOutcome,
    _errorMessage: string | null,
  ): Promise<void> {
    await this.redis.lrem(this.keys.processing, 1, raw);
    if (outcome === "ack") return;

    if (outcome === "fail" || envelope.retries >= this.maxRetries) {
      return;
    }

    envelope.retries += 1;
    await this.redis.lpush(this.keys.pending, JSON.stringify(envelope));
  }
}
