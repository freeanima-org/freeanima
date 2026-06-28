import { createEntityModuleRegistry } from "@freeanima/core/repos";

const registry = createEntityModuleRegistry("entity task module");

export const registerEntityTaskModule = registry.register.bind(registry);
export const getEntityStoreForTask = registry.getEntityStore.bind(registry);
export const getEntitySearchForTask = registry.getEntitySearch.bind(registry);
export const resetEntityTaskModuleForTests = registry.resetForTests.bind(registry);

export function defaultTaskWorldId(): number {
  return 1;
}
