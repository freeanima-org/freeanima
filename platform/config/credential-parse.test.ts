import { describe, it, expect } from "bun:test";
import { assertYamlDictRoundtrip, parseCredentialDict } from "./credential-parse.ts";
import { stringifyYaml } from "./yaml.ts";

const INVALID_HAND_EDITED = `password: not-a-real-password
username: test-user
email: test@example.com
url: https://www.npmjs.com
desc: npm account for unit test
tags: dev;npmtoken: npm_FAKE_UNIT_TEST_TOKEN_PLACEHOLDER`;

describe("parseCredentialDict", () => {
  it("parses valid YAML dict", () => {
    const yaml = stringifyYaml({ url: "postgresql://x", desc: "test" });
    expect(parseCredentialDict(yaml, "services/postgres/anima").url).toBe("postgresql://x");
  });

  it("rejects hand-edited key:value lines that are not valid YAML", () => {
    expect(() => parseCredentialDict(INVALID_HAND_EDITED, "dev/npm")).toThrow(/not valid YAML/);
  });

  it("rejects plaintext scalar", () => {
    expect(() => parseCredentialDict("sk-live-abc123", "services/firecrawl")).toThrow(
      /must be a YAML dict/,
    );
  });
});

describe("assertYamlDictRoundtrip", () => {
  it("accepts stringifyYaml output with special characters", () => {
    const content = stringifyYaml({
      tags: "dev",
      npmtoken: "npm_FAKE_UNIT_TEST_TOKEN_PLACEHOLDER",
    });
    expect(() => assertYamlDictRoundtrip(content, "dev/npm")).not.toThrow();
  });

  it("rejects content that does not roundtrip as dict", () => {
    expect(() => assertYamlDictRoundtrip(INVALID_HAND_EDITED, "dev/npm")).toThrow(/not valid YAML/);
  });
});
