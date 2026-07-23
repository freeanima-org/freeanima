import { describe, expect, test } from "bun:test";

import {
  createVerifier,
  deriveMasterKey,
  randomSalt,
  resolveSecretField,
  verifyMasterKey,
  type VaultSecretsPayload,
} from "./index.ts";

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

describe("resolveSecretField", () => {
  const secrets: VaultSecretsPayload = {
    password: " pass\n",
    notes: "  keep spaces  ",
    totp: " 123456 ",
    custom_fields: [
      { name: "github_pat", value: "ghp_xxx\n", type: "hidden" },
      { name: "api_token", value: " tok ", type: "text" },
      { name: "dup", value: "first", type: "text" },
      { name: "dup", value: "second", type: "text" },
    ],
  };

  test("内置字段与 custom 均用裸名；凭据 trim、notes 保留空白", () => {
    expect(resolveSecretField(secrets, "password")).toBe("pass");
    expect(resolveSecretField(secrets, "notes")).toBe("  keep spaces  ");
    expect(resolveSecretField(secrets, "totp")).toBe("123456");
    expect(resolveSecretField(secrets, "github_pat")).toBe("ghp_xxx");
    expect(resolveSecretField(secrets, "api_token")).toBe("tok");
  });

  test("同名 custom 取第一个；保留字优先于同名 custom", () => {
    expect(resolveSecretField(secrets, "dup")).toBe("first");
    const withClash: VaultSecretsPayload = {
      password: "builtin",
      custom_fields: [{ name: "password", value: "custom", type: "hidden" }],
    };
    expect(resolveSecretField(withClash, "password")).toBe("builtin");
  });

  test("旧下标路径仍可用", () => {
    expect(resolveSecretField(secrets, "custom_fields.0.value")).toBe("ghp_xxx");
    expect(resolveSecretField(secrets, "custom_fields.1.value")).toBe("tok");
  });

  test("未知字段返回 undefined", () => {
    expect(resolveSecretField(secrets, "missing")).toBeUndefined();
  });
});
