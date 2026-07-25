import { describe, expect, test } from "bun:test";

import {
  createVerifier,
  deriveMasterKey,
  generateTotpCode,
  normalizeTotpSecret,
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

describe("normalizeTotpSecret", () => {
  test("去空格与大小写归一", () => {
    expect(normalizeTotpSecret(" jbsw y3dp ehpk 3pxp ")).toBe("JBSWY3DPEHPK3PXP");
  });

  test("解析 otpauth URI", () => {
    expect(
      normalizeTotpSecret(
        "otpauth://totp/Example:user@ex.com?secret=JBSWY3DPEHPK3PXP&issuer=Example",
      ),
    ).toBe("JBSWY3DPEHPK3PXP");
  });

  test("无效 URI / 空串", () => {
    expect(normalizeTotpSecret("")).toBe("");
    expect(normalizeTotpSecret("otpauth://totp/x?issuer=y")).toBe("");
  });
});

describe("generateTotpCode", () => {
  // RFC 6238 Appendix B seed "12345678901234567890" 的 Base32
  const rfcSeedB32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  test("RFC 6238 SHA1 8 位向量", () => {
    const vectors: Array<{ tSec: number; code: string }> = [
      { tSec: 59, code: "94287082" },
      { tSec: 1_111_111_109, code: "07081804" },
      { tSec: 1_111_111_111, code: "14050471" },
      { tSec: 1_234_567_890, code: "89005924" },
      { tSec: 2_000_000_000, code: "69279037" },
      { tSec: 20_000_000_000, code: "65353130" },
    ];
    for (const { tSec, code } of vectors) {
      const result = generateTotpCode(rfcSeedB32, tSec * 1000, { digits: 8 });
      expect(result?.code).toBe(code);
      expect(result?.period).toBe(30);
      expect(result?.periodRemaining).toBeGreaterThan(0);
      expect(result?.periodRemaining).toBeLessThanOrEqual(30);
    }
  });

  test("无效密钥返回 null", () => {
    expect(generateTotpCode("!!!")).toBeNull();
    expect(generateTotpCode("")).toBeNull();
  });
});

describe("resolveSecretField", () => {
  const secrets: VaultSecretsPayload = {
    password: " pass\n",
    notes: "  keep spaces  ",
    // RFC seed；在 t=59s 时 8 位码为 94287082，默认 6 位为后 6 位截断… 实际是 mod 10^6
    totp: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
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
    expect(resolveSecretField(secrets, "github_pat")).toBe("ghp_xxx");
    expect(resolveSecretField(secrets, "api_token")).toBe("tok");
  });

  test("totp 返回当前动态码而非密钥原文", () => {
    // 固定 t=59s → 8 位 94287082 → 6 位 287082
    const at59 = generateTotpCode(secrets.totp!, 59_000);
    expect(at59?.code).toBe("287082");
    // resolveSecretField 用 Date.now()；用 generateTotpCode 对照即可验证语义已切换
    const live = resolveSecretField(secrets, "totp");
    expect(live).toMatch(/^\d{6}$/);
    expect(live).not.toBe(secrets.totp);
  });

  test("无效 totp 密钥返回 undefined", () => {
    expect(resolveSecretField({ totp: "!!!" }, "totp")).toBeUndefined();
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

  test("card / identity 嵌套路径", () => {
    const nested: VaultSecretsPayload = {
      card: { number: "4111", code: "123" },
      identity: { email: " a@b.c ", first_name: "Ada" },
    };
    expect(resolveSecretField(nested, "card.number")).toBe("4111");
    expect(resolveSecretField(nested, "card.code")).toBe("123");
    expect(resolveSecretField(nested, "identity.email")).toBe("a@b.c");
    expect(resolveSecretField(nested, "identity.first_name")).toBe("Ada");
    expect(resolveSecretField(nested, "card.missing")).toBeUndefined();
  });
});
