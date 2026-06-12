import type { PgRepositories } from "@freeanima/core/repos";
import type { Db } from "./client.ts";
import { pgAutobiographicalMemoryStore } from "./autobiographical-memory/pg-autobiographical-memory-store.ts";
import { pgCronJobStore } from "./cron/pg-cron-job-store.ts";
import { pgCronLogStore } from "./cron/pg-cron-log-store.ts";
import { pgLimbicMemoryStore } from "./limbic-memory/pg-limbic-memory-store.ts";
import { pgSelfLayerStore } from "./self-layer/pg-self-layer-store.ts";
import { pgMemoryReferenceStore } from "./memory-reference/pg-memory-reference-store.ts";
import { pgSemanticMemoryStore } from "./semantic-memory/pg-semantic-memory-store.ts";
import { pgSessionStore } from "./session/pg-session-store.ts";
import { pgTaskStore } from "./tasks/pg-task-store.ts";

export function createPgRepositories(_opts: { getDb: () => Db }): PgRepositories {
  return {
    pgAvailable: true,
    session: pgSessionStore,
    semanticMemory: pgSemanticMemoryStore,
    memoryReference: pgMemoryReferenceStore,
    selfLayer: pgSelfLayerStore,
    autobiographicalMemory: pgAutobiographicalMemoryStore,
    limbicMemory: pgLimbicMemoryStore,
    cron: pgCronJobStore,
    cronLog: pgCronLogStore,
    tasks: pgTaskStore,
  };
}
