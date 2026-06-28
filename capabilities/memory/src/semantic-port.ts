import type { SemanticMemoryStorePort } from "@freeanima/core/repos";

import { createMemoryPortRegistry } from "./port-registry.ts";

const semantic = createMemoryPortRegistry<SemanticMemoryStorePort>("semantic memory store");

export const registerSemanticMemoryStore = semantic.register;
export const getSemanticMemoryStore = semantic.get;
export const resetSemanticMemoryStoreForTests = semantic.resetForTests;
