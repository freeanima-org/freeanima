import { describe, expect, it } from "bun:test";

import { applyServiceUpdate, checkServiceUpdate } from "./service-update.ts";

describe("service-update (source tree)", () => {
  it("checkServiceUpdate reports source not upgradable in monorepo/dev", async () => {
    const result = await checkServiceUpdate();
    expect(result.ok).toBe(true);
    expect(result.upgradable).toBe(false);
    if (!result.upgradable) {
      expect(result.reason === "source" || result.reason === "unsafe_prefix").toBe(true);
      expect(typeof result.hint === "string" || result.hint === undefined).toBe(true);
    }
  });

  it("applyServiceUpdate fails without upgrading in monorepo/dev", async () => {
    const result = await applyServiceUpdate();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason === "source" || result.reason === "unsafe_prefix").toBe(true);
    }
  });
});
