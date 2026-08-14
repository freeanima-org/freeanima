import {
  decryptCachePayload,
  encryptCachePayload,
  type VaultLocalCachePayload,
} from "./local-cache-crypto.ts";

function listMeta(cache: VaultLocalCachePayload): Array<Record<string, unknown>> {
  return cache.items.map((item) => {
    const row = { ...(item as Record<string, unknown>) };
    delete row.secrets_enc;
    delete row.dek_wrapped;
    return row;
  });
}

async function testKey(): Promise<CryptoKey> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

describe("vault local-cache crypto", () => {
  test("encrypt/decrypt roundtrip", async () => {
    const key = await testKey();
    const payload: VaultLocalCachePayload = {
      version: 1,
      updatedAtMs: 1,
      items: [
        {
          id: 9,
          title: "Example",
          username: "a",
          url: "https://example.com/",
          secrets_enc: "iv:cipher",
          dek_wrapped: "iv:wrapped",
        },
      ],
    };
    const blob = await encryptCachePayload(payload, key);
    expect(blob.iv.length).toBeGreaterThan(0);
    expect(blob.cipher.length).toBeGreaterThan(0);
    const opened = await decryptCachePayload(blob, key);
    expect(opened).toEqual(payload);
    expect(listMeta(opened)[0]?.username).toBe("a");
    expect("secrets_enc" in (listMeta(opened)[0] as object)).toBe(false);
  });

  test("wrong key fails decrypt", async () => {
    const a = await testKey();
    const b = await testKey();
    const blob = await encryptCachePayload({ version: 1, updatedAtMs: 1, items: [] }, a);
    await expect(decryptCachePayload(blob, b)).rejects.toBeDefined();
  });
});
