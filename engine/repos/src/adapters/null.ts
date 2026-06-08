import type { PgRepositories } from "../ports/index.ts";
import { nullAutobiographicalMemoryStore } from "./null-autobiographical-memory.ts";
import { nullCronJobStore } from "./null-cron.ts";
import { nullLimbicMemoryStore } from "./null-limbic-memory.ts";
import { nullSelfLayerStore } from "./null-self-layer.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";
import { nullSessionStore } from "./null-session.ts";
import { nullTaskStore } from "./null-task.ts";

export const nullPgRepositories: PgRepositories = {
  pgAvailable: false,
  session: nullSessionStore,
  semanticMemory: nullSemanticMemoryStore,
  selfLayer: nullSelfLayerStore,
  autobiographicalMemory: nullAutobiographicalMemoryStore,
  limbicMemory: nullLimbicMemoryStore,
  cron: nullCronJobStore,
  tasks: nullTaskStore,
};
