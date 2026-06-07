import type { PgRepositories } from "@freeanima/engine-repos";
import type { Db } from "./client.ts";
import { PgAutobiographicalMemoryStore } from "./autobiographical-memory/pg-autobiographical-memory-store.ts";
import { PgCronJobStore } from "./cron/pg-cron-job-store.ts";
import { PgSelfLayerStore } from "./self-layer/pg-self-layer-store.ts";
import { PgSemanticMemoryStore } from "./semantic-memory/pg-semantic-memory-store.ts";
import { PgSessionStore } from "./session/pg-session-store.ts";

export function createPgRepositories(_opts: { getDb: () => Db }): PgRepositories {
  return {
    pgAvailable: true,
    session: new PgSessionStore(),
    semanticMemory: new PgSemanticMemoryStore(),
    selfLayer: new PgSelfLayerStore(),
    autobiographicalMemory: new PgAutobiographicalMemoryStore(),
    cron: new PgCronJobStore(),
  };
}
