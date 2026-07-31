import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";
import {
  CACHE_VERSION,
  decryptCachePayload,
  encryptCachePayload,
  type EncryptedCacheBlob,
  type VaultLocalCachePayload as CachePayloadBase,
} from "./local-cache-crypto.ts";
import { getExtVaultSession } from "./session.ts";

const CACHE_STORAGE_KEY = "freeanima.vault_ext.encrypted_cache";

export type CachedVaultItem = VaultItemMetaRowPayload & {
  secrets_enc?: string;
  dek_wrapped?: string;
};

export type VaultLocalCachePayload = Omit<CachePayloadBase, "items"> & {
  items: CachedVaultItem[];
};

type StorageLike = {
  get: (key: string) => Promise<EncryptedCacheBlob | undefined>;
  set: (key: string, value: EncryptedCacheBlob) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

let memoryCache: VaultLocalCachePayload | null = null;

function asBufferSource(bytes: Uint8Array): BufferSource {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function importAesGcmKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(raw),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 默认 chrome.storage.local；单测可注入 */
export function createChromeLocalCacheStorage(): StorageLike {
  return {
    async get(key) {
      const data = await chrome.storage.local.get(key);
      return data[key] as EncryptedCacheBlob | undefined;
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
  };
}

let storage: StorageLike = createChromeLocalCacheStorage();

/** 单测用 */
export function setLocalCacheStorageForTest(next: StorageLike | null): void {
  storage = next ?? createChromeLocalCacheStorage();
  memoryCache = null;
}

export function clearLocalCacheMemory(): void {
  memoryCache = null;
}

async function masterKeyForCache(): Promise<CryptoKey> {
  const raw = await getExtVaultSession().exportMasterKeyRaw();
  if (!raw) throw new Error("vault_locked");
  return importAesGcmKey(raw);
}

export async function loadLocalCache(): Promise<VaultLocalCachePayload | null> {
  if (memoryCache) return memoryCache;
  const blob = await storage.get(CACHE_STORAGE_KEY);
  if (!blob?.iv || !blob?.cipher) return null;
  try {
    const masterKey = await masterKeyForCache();
    memoryCache = (await decryptCachePayload(blob, masterKey)) as VaultLocalCachePayload;
    return memoryCache;
  } catch {
    memoryCache = null;
    return null;
  }
}

export async function saveLocalCache(items: CachedVaultItem[]): Promise<void> {
  const payload: VaultLocalCachePayload = {
    version: CACHE_VERSION,
    updatedAtMs: Date.now(),
    items,
  };
  const masterKey = await masterKeyForCache();
  const blob = await encryptCachePayload(payload, masterKey);
  await storage.set(CACHE_STORAGE_KEY, blob);
  memoryCache = payload;
}

export async function upsertLocalCacheItem(item: CachedVaultItem): Promise<void> {
  const current = (await loadLocalCache())?.items ?? [];
  const next = [...current.filter((i) => i.id !== item.id), item];
  await saveLocalCache(next);
}

export async function removeLocalCacheItem(itemId: number): Promise<void> {
  const current = (await loadLocalCache())?.items ?? [];
  if (!current.some((i) => i.id === itemId)) return;
  await saveLocalCache(current.filter((i) => i.id !== itemId));
}

export async function clearEncryptedLocalCache(): Promise<void> {
  memoryCache = null;
  await storage.remove(CACHE_STORAGE_KEY);
}

export function listMetaFromCache(cache: VaultLocalCachePayload): VaultItemMetaRowPayload[] {
  return cache.items.map(({ secrets_enc: _s, dek_wrapped: _d, ...meta }) => meta);
}

export { decryptCachePayload, encryptCachePayload } from "./local-cache-crypto.ts";
