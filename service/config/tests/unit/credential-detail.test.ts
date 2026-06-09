import { describe, it, expect } from "bun:test";
import { getCredentialDetail } from "../../src/credential.ts";

describe("getCredentialDetail", () => {
  it("未知路径抛出 RuntimeError", () => {
    expect(() => getCredentialDetail("__nonexistent_credential_path__")).toThrow(/not found/i);
  });
});
