import { describe, it, expect } from "bun:test";
import { getCredentialDetail } from "./credential.ts";

describe("getCredentialDetail", () => {
  it("unknown path throws RuntimeError", () => {
    expect(() => getCredentialDetail("__nonexistent_credential_path__")).toThrow(/not found/i);
  });
});
