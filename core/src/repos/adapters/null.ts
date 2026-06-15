import type { PgRepositories } from "../ports/index.ts";
import { nullAutobiographicalMemoryStore } from "./null-autobiographical-memory.ts";
import { nullCronJobStore } from "./null-cron.ts";
import { nullCronLogStore } from "./null-cron-log.ts";
import { nullPipelineStepRunStore } from "./null-pipeline-step-run.ts";
import { nullDreamMemoryStore } from "./null-dream-memory.ts";
import { nullLimbicMemoryStore } from "./null-limbic-memory.ts";
import { nullSelfLayerStore } from "./null-self-layer.ts";
import { nullMemoryReferenceStore } from "./null-memory-reference.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";
import { nullSessionStore } from "./null-session.ts";
import { nullTaskStore } from "./null-task.ts";

export const nullPgRepositories: PgRepositories = {
  pgAvailable: false,
  session: nullSessionStore,
  semanticMemory: nullSemanticMemoryStore,
  memoryReference: nullMemoryReferenceStore,
  selfLayer: nullSelfLayerStore,
  autobiographicalMemory: nullAutobiographicalMemoryStore,
  limbicMemory: nullLimbicMemoryStore,
  dreamMemory: nullDreamMemoryStore,
  cron: nullCronJobStore,
  cronLog: nullCronLogStore,
  pipelineStepRun: nullPipelineStepRunStore,
  tasks: nullTaskStore,
};
