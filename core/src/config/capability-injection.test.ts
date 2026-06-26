import { afterEach, describe, expect, it } from "bun:test";

import {
  credentialForCapability,
  listCredentialsForCapability,
  readAppVersionForCapability,
  registerCapabilityInjection,
  resetCapabilityInjectionForTest,
} from "./capability-injection.ts";

describe("capability-injection", () => {
  afterEach(() => {
    resetCapabilityInjectionForTest();
  });

  it("throws when listCredentials not registered", () => {
    expect(() => listCredentialsForCapability()).toThrow("listCredentials not registered");
  });

  it("throws when credential not registered", () => {
    expect(() => credentialForCapability("a", "b")).toThrow("credential not registered");
  });

  it("delegates to injected helpers", () => {
    registerCapabilityInjection({
      listCredentials: () => [{ path: "llm/openai", category: "llm" }],
      credential: (path, field) => `${path}:${field}`,
      readAppVersion: () => "9.9.9",
    });
    expect(listCredentialsForCapability()).toEqual([{ path: "llm/openai", category: "llm" }]);
    expect(credentialForCapability("llm/openai", "api_key")).toBe("llm/openai:api_key");
    expect(readAppVersionForCapability()).toBe("9.9.9");
  });

  it("merges partial injection updates", () => {
    registerCapabilityInjection({ readAppVersion: () => "1.0.0" });
    registerCapabilityInjection({
      credential: () => "secret",
    });
    expect(readAppVersionForCapability()).toBe("1.0.0");
    expect(credentialForCapability("x", "y")).toBe("secret");
  });
});
