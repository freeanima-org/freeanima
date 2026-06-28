import type { LimbicMemoryStorePort } from "@freeanima/core/repos";

import { createMemoryPortRegistry } from "./port-registry.ts";

const limbic = createMemoryPortRegistry<LimbicMemoryStorePort>("limbic memory store");

export const registerLimbicMemoryStore = limbic.register;
export const getLimbicMemoryStore = limbic.get;
export const resetLimbicMemoryStoreForTests = limbic.resetForTests;
