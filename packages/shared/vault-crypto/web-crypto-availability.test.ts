import { describe, expect, test } from "bun:test";

import {
  isVaultWebCryptoAvailable,
  suggestHabitatHttpsUnlockUrl,
  vaultWebCryptoUnavailableMessage,
} from "./web-crypto-availability.ts";

describe("vault web crypto availability", () => {
  test("subtle 存在时可用", () => {
    expect(isVaultWebCryptoAvailable(globalThis.crypto)).toBe(true);
  });

  test("无 subtle 时不可用", () => {
    expect(
      isVaultWebCryptoAvailable({ getRandomValues: () => new Uint8Array() } as unknown as Crypto),
    ).toBe(false);
    expect(isVaultWebCryptoAvailable(null)).toBe(false);
  });

  test("suggestHabitatHttpsUnlockUrl 仅改写局域网 :2658", () => {
    expect(suggestHabitatHttpsUnlockUrl("http://10.0.0.2:2658/web/vault")).toBe(
      "https://10.0.0.2:2659/web/vault",
    );
    expect(suggestHabitatHttpsUnlockUrl("http://feng.lan:2658/web/chat")).toBe(
      "https://feng.lan:2659/web/chat",
    );
    expect(suggestHabitatHttpsUnlockUrl("http://127.0.0.1:2658/web/vault")).toBeNull();
    expect(suggestHabitatHttpsUnlockUrl("http://localhost:5000/web/vault")).toBeNull();
    expect(suggestHabitatHttpsUnlockUrl("https://10.0.0.2:2659/web/vault")).toBeNull();
    expect(suggestHabitatHttpsUnlockUrl("http://10.0.0.2:5000/web/vault")).toBeNull();
  });

  test("不可用文案含引导", () => {
    const msg = vaultWebCryptoUnavailableMessage({
      pageHref: "http://192.168.1.10:2658/web/vault",
    });
    expect(msg).toContain("非安全上下文");
    expect(msg).toContain("https://192.168.1.10:2659/web/vault");
  });
});
