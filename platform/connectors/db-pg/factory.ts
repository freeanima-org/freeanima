import type { PgRepositories } from "@freeanima/core/repos";
import type { Db } from "./client.ts";
import { pgAutoLlmRunStore } from "./auto-llm-run/pg-auto-llm-run-store.ts";
import { pgAutobiographicalMemoryStore } from "./autobiographical-memory/pg-autobiographical-memory-store.ts";
import { pgCronJobStore } from "./cron/pg-cron-job-store.ts";
import { pgCronLogStore } from "./cron/pg-cron-log-store.ts";
import { pgPipelineStepRunStore } from "./pipeline/pg-pipeline-step-run-store.ts";
import { pgDreamMemoryStore } from "./dream-memory/pg-dream-memory-store.ts";
import { pgLimbicMemoryStore } from "./limbic-memory/pg-limbic-memory-store.ts";
import { pgSelfLayerStore } from "./self-layer/pg-self-layer-store.ts";
import { pgMemoryReferenceStore } from "./memory-reference/pg-memory-reference-store.ts";
import { pgSemanticMemoryStore } from "./semantic-memory/pg-semantic-memory-store.ts";
import { pgConversationStore } from "./conversation/pg-conversation-store.ts";
import { pgSapInstanceStore } from "./sap/pg-sap-instance-store.ts";
import { pgEntityStore } from "./entity/pg-entity-store.ts";
import { pgNotificationStore } from "./notifications/pg-notification-store.ts";

export function createPgRepositories(_opts: { getDb: () => Db }): PgRepositories {
  return {
    pgAvailable: true,
    conversation: pgConversationStore,
    semanticMemory: pgSemanticMemoryStore,
    memoryReference: pgMemoryReferenceStore,
    selfLayer: pgSelfLayerStore,
    autobiographicalMemory: pgAutobiographicalMemoryStore,
    limbicMemory: pgLimbicMemoryStore,
    dreamMemory: pgDreamMemoryStore,
    cron: pgCronJobStore,
    cronLog: pgCronLogStore,
    pipelineStepRun: pgPipelineStepRunStore,
    autoLlmRun: pgAutoLlmRunStore,
    entity: pgEntityStore,
    notifications: pgNotificationStore,
    sapInstance: pgSapInstanceStore,
  };
}
