import { describe, expect, test } from "bun:test";

import { createMemoryPortRegistry } from "./port-registry.ts";

describe("createMemoryPortRegistry", () => {
  test("register/get/reset", () => {
    const port = createMemoryPortRegistry<{ id: string }>("test store");
    expect(() => port.get()).toThrow(/test store/);
    port.register({ id: "x" });
    expect(port.get().id).toBe("x");
    port.resetForTests();
    expect(() => port.get()).toThrow(/test store/);
  });
});
