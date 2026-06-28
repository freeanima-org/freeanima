import type { AutobiographicalMemoryStorePort } from "@freeanima/core/repos";

import { createMemoryPortRegistry } from "./port-registry.ts";

const autobiographical = createMemoryPortRegistry<AutobiographicalMemoryStorePort>(
  "autobiographical memory store",
);

export const registerAutobiographicalMemoryStore = autobiographical.register;
export const getAutobiographicalMemoryStore = autobiographical.get;
export const resetAutobiographicalMemoryStoreForTests = autobiographical.resetForTests;
