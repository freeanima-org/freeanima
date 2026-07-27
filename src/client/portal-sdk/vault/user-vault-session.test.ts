import { describe, expect, test } from "bun:test";

import { createVerifier, deriveMasterKey, randomSalt } from "@freeanima/shared/vault-crypto";

import {
  UserVaultSession,
  VAULT_UI_SCOPE,
  resetUserVaultSessionForTest,
} from "./user-vault-session.ts";

describe("UserVaultSession absolute + hydrate", () => {
  test("export / hydrate 可恢复解锁态", async () => {
    resetUserVaultSessionForTest();
    const salt = randomSalt();
    const key = await deriveMasterKey("test-password-12345678", salt, undefined, {
      extractable: true,
    });
    const verifier = await createVerifier(key);

    const session = new UserVaultSession();
    session.configure({
      timeoutMs: 8 * 60 * 60 * 1000,
      timeoutMode: "absolute",
      extractableMasterKey: true,
    });
    await session.unlock({
      masterPassword: "test-password-12345678",
      salt,
      verifier,
      conversationId: "__vault_ext__",
    });
    expect(session.isUnlocked("__vault_ext__")).toBe(true);
    const raw = await session.exportMasterKeyRaw();
    expect(raw).not.toBeNull();
    const unlockedAt = session.getExpiresAtMs()! - 8 * 60 * 60 * 1000;
    const scopes = session.listUnlockedScopes();
    session.lock();
    expect(session.isUnlocked("__vault_ext__")).toBe(false);

    await session.hydrateFromMasterKeyRaw(raw!, scopes, unlockedAt);
    expect(session.isUnlocked("__vault_ext__")).toBe(true);
    expect(session.getExpiresAtMs()).toBeGreaterThan(Date.now());
  });

  test("hydrate 已过期则失败并保持锁定", async () => {
    const salt = randomSalt();
    const key = await deriveMasterKey("test-password-12345678", salt, undefined, {
      extractable: true,
    });
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    const session = new UserVaultSession();
    session.configure({
      timeoutMs: 1000,
      timeoutMode: "absolute",
      extractableMasterKey: true,
    });
    await expect(
      session.hydrateFromMasterKeyRaw(raw, [VAULT_UI_SCOPE], Date.now() - 5000),
    ).rejects.toThrow("vault_session_expired");
    expect(session.getState()).toBe("locked");
  });
});
