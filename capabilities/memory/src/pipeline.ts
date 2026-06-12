import type {
  AutobiographicalMemoryStorePort,
  LimbicMemoryStorePort,
  SemanticMemoryStorePort,
  SessionStorePort,
} from "@freeanima/core/repos";
import { registerAutobiographicalMemoryStore } from "./autobiographical-port.ts";
import { registerLimbicMemoryStore } from "./limbic-port.ts";
import { registerMemorySessionStore } from "./session-port.ts";
import { registerSemanticMemoryStore } from "./semantic-port.ts";

export type MemoryPipelineStores = {
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
  autobiographicalStore: AutobiographicalMemoryStorePort;
  limbicStore: LimbicMemoryStorePort;
};

/** Register memory pipeline dependencies (session / semantic / autobiographical / limbic stores) */
export function registerMemoryPipeline(stores: MemoryPipelineStores): void {
  registerMemorySessionStore(stores.sessionStore);
  registerSemanticMemoryStore(stores.semanticStore);
  registerAutobiographicalMemoryStore(stores.autobiographicalStore);
  registerLimbicMemoryStore(stores.limbicStore);
}
