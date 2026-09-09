import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";

import {
  mergeCachedVaultItem,
  pickNewerLastUsedAt,
  vaultLastUsedMs,
  type CachedVaultItem,
} from "./local-cache.ts";
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

function meta(partial: Partial<VaultItemMetaRowPayload> & { id: number }): VaultItemMetaRowPayload {
  return {
    title: "t",
    content: "",
    item_type: "login",
    tag_ids: [],
    custom_field_names: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
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

describe("last_used_at merge", () => {
  test("pickNewerLastUsedAt 取较新 ISO", () => {
    expect(pickNewerLastUsedAt("2024-01-01T00:00:00.000Z", "2025-06-01T00:00:00.000Z")).toBe(
      "2025-06-01T00:00:00.000Z",
    );
    expect(pickNewerLastUsedAt("2025-06-01T00:00:00.000Z", undefined)).toBe(
      "2025-06-01T00:00:00.000Z",
    );
    expect(pickNewerLastUsedAt(undefined, "2025-06-01T00:00:00.000Z")).toBe(
      "2025-06-01T00:00:00.000Z",
    );
    expect(vaultLastUsedMs(undefined)).toBe(0);
  });

  test("mergeCachedVaultItem 保留较新 last_used_at 与本地密文", () => {
    const remote = meta({ id: 1, title: "remote", last_used_at: "2024-01-01T00:00:00.000Z" });
    const local: CachedVaultItem = {
      ...meta({ id: 1, title: "local", last_used_at: "2026-09-09T12:00:00.000Z" }),
      secrets_enc: "s",
      dek_wrapped: "d",
    };
    const merged = mergeCachedVaultItem(remote, local);
    expect(merged.last_used_at).toBe("2026-09-09T12:00:00.000Z");
    expect(merged.title).toBe("remote");
    expect(merged.secrets_enc).toBe("s");
    expect(merged.dek_wrapped).toBe("d");
  });

  test("mergeCachedVaultItem remote 更新时采用 Habitat 时间", () => {
    const remote = meta({ id: 1, last_used_at: "2026-09-09T15:00:00.000Z" });
    const local: CachedVaultItem = {
      ...meta({ id: 1, last_used_at: "2026-09-09T12:00:00.000Z" }),
    };
    expect(mergeCachedVaultItem(remote, local).last_used_at).toBe("2026-09-09T15:00:00.000Z");
  });

  test("mergeCachedVaultItem touch 回包缺 last_used_at 时保留本地", () => {
    const remote = meta({ id: 1 });
    const local: CachedVaultItem = {
      ...meta({ id: 1, last_used_at: "2026-09-09T12:00:00.000Z" }),
      secrets_enc: "s",
      dek_wrapped: "d",
    };
    expect(mergeCachedVaultItem(remote, local).last_used_at).toBe("2026-09-09T12:00:00.000Z");
  });
});
