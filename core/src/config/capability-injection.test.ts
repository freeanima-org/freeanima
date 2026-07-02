import { afterEach, describe, expect, it } from "bun:test";

import {
  readAppVersionForCapability,
  registerCapabilityInjection,
  resetCapabilityInjectionForTest,
  vaultForCapability,
} from "./capability-injection.ts";

describe("capability-injection", () => {
  afterEach(() => {
    resetCapabilityInjectionForTest();
  });

  it("throws when vault not registered", async () => {
    await expect(vaultForCapability(1, "password")).rejects.toThrow("vault not registered");
  });

  it("delegates to injected helpers", async () => {
    registerCapabilityInjection({
      vault: async (itemId, field) => `${itemId}:${field}`,
      readAppVersion: () => "9.9.9",
    });
    await expect(vaultForCapability(42, "token")).resolves.toBe("42:token");
    expect(readAppVersionForCapability()).toBe("9.9.9");
  });

  it("merges partial injection updates", async () => {
    registerCapabilityInjection({ readAppVersion: () => "1.0.0" });
    registerCapabilityInjection({
      vault: async () => "secret",
    });
    expect(readAppVersionForCapability()).toBe("1.0.0");
    await expect(vaultForCapability(1, "x")).resolves.toBe("secret");
  });
});
