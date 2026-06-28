import { createEntityModuleRegistry } from "@freeanima/core/repos";

const registry = createEntityModuleRegistry("entity email module");

export const registerEntityEmailModule = registry.register.bind(registry);
export const getEntityStoreForEmail = registry.getEntityStore.bind(registry);
export const getEntitySearchForEmail = registry.getEntitySearch.bind(registry);
export const resetEntityEmailModuleForTests = registry.resetForTests.bind(registry);

export function defaultEmailWorldId(): number {
  return 1;
}
