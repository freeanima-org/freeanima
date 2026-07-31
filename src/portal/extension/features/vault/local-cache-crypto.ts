const CACHE_VERSION = 1;
const AES_GCM_IV_BYTES = 12;

export type VaultLocalCachePayload = {
  version: typeof CACHE_VERSION;
  updatedAtMs: number;
  items: unknown[];
};

export type EncryptedCacheBlob = {
  iv: string;
  cipher: string;
};

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/** AES-GCM 加密缓存 JSON（主密钥） */
export async function encryptCachePayload(
  payload: VaultLocalCachePayload,
  masterKey: CryptoKey,
): Promise<EncryptedCacheBlob> {
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    masterKey,
    asBufferSource(new TextEncoder().encode(JSON.stringify(payload))),
  );
  return { iv: bytesToB64(iv), cipher: bytesToB64(new Uint8Array(cipher)) };
}

export async function decryptCachePayload(
  blob: EncryptedCacheBlob,
  masterKey: CryptoKey,
): Promise<VaultLocalCachePayload> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(b64ToBytes(blob.iv)) },
    masterKey,
    asBufferSource(b64ToBytes(blob.cipher)),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as VaultLocalCachePayload;
  if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed.items)) {
    throw new Error("invalid_cache_payload");
  }
  return parsed;
}

export { CACHE_VERSION };
