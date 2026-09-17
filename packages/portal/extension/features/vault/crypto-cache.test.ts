import {
  clearCryptoCache,
  hasCryptoCache,
  isValidCryptoCache,
  loadCryptoCache,
  saveCryptoCache,
  setCryptoCacheStorageForTest,
  type ExtVaultCryptoCache,
} from "./crypto-cache.ts";

function memoryStorage() {
  const map = new Map<string, ExtVaultCryptoCache>();
  return {
    async get(key: string) {
      return map.get(key);
    },
    async set(key: string, value: ExtVaultCryptoCache) {
      map.set(key, value);
    },
    async remove(key: string) {
      map.delete(key);
    },
  };
}

describe("ext vault crypto-cache", () => {
  afterEach(() => {
    setCryptoCacheStorageForTest(null);
  });

  test("isValidCryptoCache", () => {
    expect(isValidCryptoCache({ salt: "s", verifier: "v" })).toBe(true);
    expect(isValidCryptoCache({ salt: "", verifier: "v" })).toBe(false);
    expect(isValidCryptoCache(null)).toBe(false);
  });

  test("save/load/clear roundtrip", async () => {
    setCryptoCacheStorageForTest(memoryStorage());
    expect(await hasCryptoCache()).toBe(false);
    await saveCryptoCache({ salt: "salt1", verifier: "ver1" });
    expect(await hasCryptoCache()).toBe(true);
    expect(await loadCryptoCache()).toEqual({ salt: "salt1", verifier: "ver1" });
    await clearCryptoCache();
    expect(await loadCryptoCache()).toBeNull();
  });

  test("rejects invalid save", async () => {
    setCryptoCacheStorageForTest(memoryStorage());
    await expect(saveCryptoCache({ salt: "", verifier: "v" })).rejects.toBeDefined();
  });
});
