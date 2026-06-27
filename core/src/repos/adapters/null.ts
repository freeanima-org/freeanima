import type { PgRepositories } from "../ports/index.ts";
import { nullAutoLlmRunStore } from "./null-auto-llm-run.ts";
import { nullAutobiographicalMemoryStore } from "./null-autobiographical-memory.ts";
import { nullCronJobStore } from "./null-cron.ts";
import { nullCronLogStore } from "./null-cron-log.ts";
import { nullPipelineStepRunStore } from "./null-pipeline-step-run.ts";
import { nullDreamMemoryStore } from "./null-dream-memory.ts";
import { nullLimbicMemoryStore } from "./null-limbic-memory.ts";
import { nullSelfLayerStore } from "./null-self-layer.ts";
import { nullMemoryReferenceStore } from "./null-memory-reference.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";
import { nullConversationStore } from "./null-conversation.ts";
import { nullEntityStore } from "./null-entity.ts";
import { nullEntitySearchStore } from "./null-entity-search.ts";
import { nullSapInstanceStore } from "./null-sap-instance.ts";
import { nullNotificationStore } from "./null-notification.ts";

export const nullPgRepositories: PgRepositories = {
  pgAvailable: false,
  conversation: nullConversationStore,
  semanticMemory: nullSemanticMemoryStore,
  memoryReference: nullMemoryReferenceStore,
  selfLayer: nullSelfLayerStore,
  autobiographicalMemory: nullAutobiographicalMemoryStore,
  limbicMemory: nullLimbicMemoryStore,
  dreamMemory: nullDreamMemoryStore,
  cron: nullCronJobStore,
  cronLog: nullCronLogStore,
  pipelineStepRun: nullPipelineStepRunStore,
  autoLlmRun: nullAutoLlmRunStore,
  entity: nullEntityStore,
  entitySearch: nullEntitySearchStore,
  notifications: nullNotificationStore,
  sapInstance: nullSapInstanceStore,
};
