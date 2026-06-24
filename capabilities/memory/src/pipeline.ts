import type {
  AutobiographicalMemoryStorePort,
  DreamMemoryStorePort,
  LimbicMemoryStorePort,
  SemanticMemoryStorePort,
  ConversationStorePort,
} from "@freeanima/core/repos";
import { registerAutobiographicalMemoryStore } from "./autobiographical-port.ts";
import { registerDreamMemoryStore } from "./dream-port.ts";
import { registerLimbicMemoryStore } from "./limbic-port.ts";
import { registerMemoryConversationStore } from "./conversation-port.ts";
import { registerSemanticMemoryStore } from "./semantic-port.ts";

export type MemoryPipelineStores = {
  conversationStore: ConversationStorePort;
  semanticStore: SemanticMemoryStorePort;
  autobiographicalStore: AutobiographicalMemoryStorePort;
  limbicStore: LimbicMemoryStorePort;
  dreamStore: DreamMemoryStorePort;
};

/** Register memory pipeline dependencies (session / semantic / autobiographical / limbic / dream stores) */
export function registerMemoryPipeline(stores: MemoryPipelineStores): void {
  registerMemoryConversationStore(stores.conversationStore);
  registerSemanticMemoryStore(stores.semanticStore);
  registerAutobiographicalMemoryStore(stores.autobiographicalStore);
  registerLimbicMemoryStore(stores.limbicStore);
  registerDreamMemoryStore(stores.dreamStore);
}
