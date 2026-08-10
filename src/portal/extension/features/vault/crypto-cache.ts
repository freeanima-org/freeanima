/** User 库 crypto 参数本地缓存：支持冷启动离线主密码解锁（非主密钥）。 */

export type ExtVaultCryptoCache = {
  salt: string;
  verifier: string;
};

const CRYPTO_STORAGE_KEY = "freeanima.vault_ext.crypto_cache";

type StorageLike = {
  get: (key: string) => Promise<ExtVaultCryptoCache | undefined>;
  set: (key: string, value: ExtVaultCryptoCache) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

function createChromeLocalCryptoStorage(): StorageLike {
  return {
    async get(key) {
      const data = await chrome.storage.local.get(key);
      return data[key] as ExtVaultCryptoCache | undefined;
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
  };
}

let storage: StorageLike = createChromeLocalCryptoStorage();

/** 单测用 */
export function setCryptoCacheStorageForTest(next: StorageLike | null): void {
  storage = next ?? createChromeLocalCryptoStorage();
}

export function isValidCryptoCache(raw: unknown): raw is ExtVaultCryptoCache {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.salt === "string" &&
    o.salt.length > 0 &&
    typeof o.verifier === "string" &&
    o.verifier.length > 0
  );
}

export async function loadCryptoCache(): Promise<ExtVaultCryptoCache | null> {
  const raw = await storage.get(CRYPTO_STORAGE_KEY);
  return isValidCryptoCache(raw) ? { salt: raw.salt, verifier: raw.verifier } : null;
}

export async function saveCryptoCache(input: ExtVaultCryptoCache): Promise<void> {
  if (!isValidCryptoCache(input)) throw new Error("invalid_crypto_cache");
  await storage.set(CRYPTO_STORAGE_KEY, { salt: input.salt, verifier: input.verifier });
}

export async function clearCryptoCache(): Promise<void> {
  await storage.remove(CRYPTO_STORAGE_KEY);
}

export async function hasCryptoCache(): Promise<boolean> {
  return (await loadCryptoCache()) != null;
}
