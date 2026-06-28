import type { DreamMemoryStorePort } from "@freeanima/core/repos";

import { createMemoryPortRegistry } from "./port-registry.ts";

const dream = createMemoryPortRegistry<DreamMemoryStorePort>("dream memory store");

export const registerDreamMemoryStore = dream.register;
export const getDreamMemoryStore = dream.get;
export const resetDreamMemoryStoreForTests = dream.resetForTests;
