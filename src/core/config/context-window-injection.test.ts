import { afterEach, describe, expect, it } from "bun:test";

import {
  lookupCatalogContextWindow,
  registerCatalogContextWindowLookup,
  resetCatalogContextWindowLookupForTest,
} from "./context-window-injection.ts";

describe("context-window-injection", () => {
  afterEach(() => {
    resetCatalogContextWindowLookupForTest();
  });

  it("returns null when lookup not registered", async () => {
    expect(await lookupCatalogContextWindow("gpt-4")).toBeNull();
  });

  it("returns null for blank model", async () => {
    registerCatalogContextWindowLookup(async () => 128_000);
    expect(await lookupCatalogContextWindow("  ")).toBeNull();
  });

  it("delegates to registered lookup", async () => {
    registerCatalogContextWindowLookup(async (model) => (model === "m1" ? 64_000 : null));
    expect(await lookupCatalogContextWindow("m1")).toBe(64_000);
    expect(await lookupCatalogContextWindow("unknown")).toBeNull();
  });

  it("ignores non-positive or thrown lookup results", async () => {
    registerCatalogContextWindowLookup(async () => 0);
    expect(await lookupCatalogContextWindow("m")).toBeNull();

    resetCatalogContextWindowLookupForTest();
    registerCatalogContextWindowLookup(async () => {
      throw new Error("catalog down");
    });
    expect(await lookupCatalogContextWindow("m")).toBeNull();
  });
});
