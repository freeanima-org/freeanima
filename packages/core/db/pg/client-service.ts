import { Service, type Context } from "cordis";
import type { DatabaseUrlResolver, Db, SqlClient } from "./client.ts";
import type { PgPoolOptions } from "./pool-options.ts";

declare module "cordis" {
  interface Context {
    pgClient: PgClientService;
  }
}

/**
 * Cordis service (`ctx.pgClient`) holding the database URL resolver and the
 * lazily created Bun SQL / Drizzle connection state. Replaces the module-level
 * singletons in `db/pg/client.ts`.
 */
export class PgClientService extends Service {
  private resolver: DatabaseUrlResolver | null = null;
  private sql: SqlClient | null = null;
  private db: Db | null = null;
  private pool: PgPoolOptions | null = null;

  constructor(ctx: Context) {
    super(ctx, "pgClient");
  }

  getResolver(): DatabaseUrlResolver | null {
    return this.resolver;
  }

  setResolver(resolver: DatabaseUrlResolver | null): void {
    this.resolver = resolver;
  }

  getSql(): SqlClient | null {
    return this.sql;
  }

  getDb(): Db | null {
    return this.db;
  }

  getPoolOptions(): PgPoolOptions | null {
    return this.pool;
  }

  setConnection(db: Db, sql: SqlClient, pool: PgPoolOptions): void {
    this.db = db;
    this.sql = sql;
    this.pool = pool;
  }

  setDb(db: Db, sql?: SqlClient): void {
    this.db = db;
    if (sql) this.sql = sql;
  }

  clearConnection(): void {
    this.sql = null;
    this.db = null;
    this.pool = null;
  }

  reset(): void {
    this.resolver = null;
    this.clearConnection();
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountPgClientService(ctx: Context): PgClientService {
  const existing = ctx.pgClient as PgClientService | undefined;
  if (existing) return existing;
  return new PgClientService(ctx);
}
