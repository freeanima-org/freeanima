import type { PgRepositories } from "@freeanima/engine-repos";
import type { Db } from "./client.ts";
import { PgCronJobStore } from "./cron/pg-cron-job-store.ts";
import { PgSemanticMemoryStore } from "./semantic-memory/pg-semantic-memory-store.ts";
import { PgSessionStore } from "./session/pg-session-store.ts";

export function createPgRepositories(_opts: { getDb: () => Db }): PgRepositories {
  return {
    pgAvailable: true,
    session: new PgSessionStore(),
    semanticMemory: new PgSemanticMemoryStore(),
    cron: new PgCronJobStore(),
  };
}
