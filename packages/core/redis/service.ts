import { RedisClient } from "bun";
import { Service, type Context } from "cordis";

export type RedisUrlResolver = () => string | null;

export type RedisConnectionConfig = {
  url: string;
};

export type RedisServiceConfig = {
  getRedisUrl: RedisUrlResolver | null;
};

declare module "cordis" {
  interface Context {
    redis: RedisService;
  }
}

function isRedisConnectionClosedError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: unknown }).code === "ERR_REDIS_CONNECTION_CLOSED"
  );
}

/**
 * Cordis service owning the Redis URL resolver and lazy client (`ctx.redis`).
 *
 * Replaces the former module-level resolver/client singletons; the persistence
 * boot phase injects the resolver and shutdown closes the connection.
 */
export class RedisService extends Service {
  private urlResolver: RedisUrlResolver | null;
  private client: RedisClient | null = null;

  constructor(ctx: Context, config: RedisServiceConfig) {
    super(ctx, "redis");
    this.urlResolver = config.getRedisUrl;
  }

  setUrlResolver(resolver: RedisUrlResolver): void {
    this.urlResolver = resolver;
    this.client = null;
  }

  getConfig(): RedisConnectionConfig | null {
    const url = this.urlResolver?.() ?? null;
    return url ? { url } : null;
  }

  isConfigured(): boolean {
    return this.getConfig() != null;
  }

  getClient(): RedisClient {
    if (this.client) return this.client;
    const cfg = this.getConfig();
    if (!cfg?.url) {
      throw new Error("Redis not configured");
    }
    this.client = new RedisClient(cfg.url);
    return this.client;
  }

  setClient(client: RedisClient): void {
    this.client = client;
  }

  async close(): Promise<void> {
    if (!this.client) return;
    try {
      this.client.close();
    } catch (err) {
      if (!isRedisConnectionClosedError(err)) throw err;
    }
    this.client = null;
  }

  reset(): void {
    this.urlResolver = null;
    this.client = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the instance). */
export function mountRedisService(
  ctx: Context,
  getRedisUrl: RedisUrlResolver | null = null,
): RedisService {
  const existing = ctx.redis as RedisService | undefined;
  if (existing) {
    if (getRedisUrl) existing.setUrlResolver(getRedisUrl);
    return existing;
  }
  return new RedisService(ctx, { getRedisUrl });
}
