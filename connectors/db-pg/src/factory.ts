import type { PgRepositories } from "@freeanima/engine-repos";
import type { Db } from "./client.ts";
import { PgAutobiographicalMemoryStore } from "./autobiographical-memory/pg-autobiographical-memory-store.ts";
import { PgCronJobStore } from "./cron/pg-cron-job-store.ts";
import { PgLimbicMemoryStore } from "./limbic-memory/pg-limbic-memory-store.ts";
import { PgSelfLayerStore } from "./self-layer/pg-self-layer-store.ts";
import { PgMemoryReferenceStore } from "./memory-reference/pg-memory-reference-store.ts";
import { PgSemanticMemoryStore } from "./semantic-memory/pg-semantic-memory-store.ts";
import { PgSessionStore } from "./session/pg-session-store.ts";
import { PgTaskStore } from "./tasks/pg-task-store.ts";

export function createPgRepositories(_opts: { getDb: () => Db }): PgRepositories {
  return {
    pgAvailable: true,
    session: new PgSessionStore(),
    semanticMemory: new PgSemanticMemoryStore(),
    memoryReference: new PgMemoryReferenceStore(),
    selfLayer: new PgSelfLayerStore(),
    autobiographicalMemory: new PgAutobiographicalMemoryStore(),
    limbicMemory: new PgLimbicMemoryStore(),
    cron: new PgCronJobStore(),
    tasks: new PgTaskStore(),
  };
}
