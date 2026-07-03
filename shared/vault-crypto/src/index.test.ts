import { describe, expect, test } from "bun:test";

import { createVerifier, deriveMasterKey, randomSalt, verifyMasterKey } from "./index.ts";

describe("vault-crypto", () => {
  test("randomSalt 可用且非空", () => {
    const salt = randomSalt();
    expect(salt.length).toBeGreaterThan(0);
  });

  test("deriveMasterKey + createVerifier + verifyMasterKey", async () => {
    const salt = randomSalt();
    const masterKey = await deriveMasterKey("test-password-12345678", salt);
    const verifier = await createVerifier(masterKey);
    expect(await verifyMasterKey(masterKey, verifier)).toBe(true);
    const wrongKey = await deriveMasterKey("wrong-password-12345678", salt);
    expect(await verifyMasterKey(wrongKey, verifier)).toBe(false);
  });
});
