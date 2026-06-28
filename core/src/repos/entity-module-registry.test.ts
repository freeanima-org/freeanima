import { describe, expect, it } from "bun:test";
import {
  createEntityModuleRegistry,
  type EntitySearchPort,
  type EntityStorePort,
} from "./entity-module-registry.ts";

describe("createEntityModuleRegistry", () => {
  it("register/get/reset round-trip", () => {
    const registry = createEntityModuleRegistry("test module");
    const store = { list: async () => [] } as unknown as EntityStorePort;
    const search = { search: async () => ({ hits: [], total: 0 }) } as unknown as EntitySearchPort;
    registry.register({ entityStore: store, entitySearch: search });
    expect(registry.getEntityStore()).toBe(store);
    expect(registry.getEntitySearch()).toBe(search);
    registry.resetForTests();
    expect(() => registry.getEntityStore()).toThrow("test module");
  });
});
