import {
  UserVaultSession,
  VAULT_UI_SCOPE,
} from "@freeanima/client/portal-sdk/vault/user-vault-session.ts";

const EXT_SCOPE = "__vault_ext__";

/** 解锁后最多 8 小时；浏览器关闭会清 chrome.storage.session */
export const EXT_VAULT_TIMEOUT_MS = 8 * 60 * 60 * 1000;

const SESSION_STORAGE_KEY = "freeanima.vault_ext.unlock_session";

type StoredUnlockSession = {
  masterKeyB64: string;
  scopes: string[];
  unlockedAtMs: number;
  expiresAtMs: number;
};

let session: UserVaultSession | null = null;
let restorePromise: Promise<void> | null = null;

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

export function getExtVaultSession(): UserVaultSession {
  if (!session) {
    session = new UserVaultSession();
    session.configure({
      timeoutMs: EXT_VAULT_TIMEOUT_MS,
      timeoutMode: "absolute",
      extractableMasterKey: true,
      onLocked: () => {
        void clearPersistedExtVaultSession();
      },
    });
  }
  return session;
}

export { EXT_SCOPE, VAULT_UI_SCOPE };

/** SW 可能被回收：先从 chrome.storage.session 恢复（浏览器关闭后无数据） */
export async function ensureExtVaultSession(): Promise<UserVaultSession> {
  const s = getExtVaultSession();
  if (s.isUnlocked(EXT_SCOPE)) return s;
  if (!restorePromise) {
    restorePromise = restoreFromStorage(s).finally(() => {
      restorePromise = null;
    });
  }
  await restorePromise;
  return s;
}

export async function isExtVaultUnlocked(): Promise<boolean> {
  const s = await ensureExtVaultSession();
  return s.isUnlocked(EXT_SCOPE);
}

export async function persistExtVaultSession(): Promise<void> {
  const s = getExtVaultSession();
  if (!s.isUnlocked(EXT_SCOPE)) {
    await clearPersistedExtVaultSession();
    return;
  }
  const raw = await s.exportMasterKeyRaw();
  const expiresAtMs = s.getExpiresAtMs();
  if (!raw || expiresAtMs == null) return;
  const payload: StoredUnlockSession = {
    masterKeyB64: bytesToB64(raw),
    scopes: s.listUnlockedScopes(),
    unlockedAtMs: expiresAtMs - EXT_VAULT_TIMEOUT_MS,
    expiresAtMs,
  };
  await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: payload });
}

export async function clearPersistedExtVaultSession(): Promise<void> {
  await chrome.storage.session.remove(SESSION_STORAGE_KEY);
}

async function restoreFromStorage(s: UserVaultSession): Promise<void> {
  const data = await chrome.storage.session.get(SESSION_STORAGE_KEY);
  const raw = data[SESSION_STORAGE_KEY] as StoredUnlockSession | undefined;
  if (!raw?.masterKeyB64 || !raw.expiresAtMs || !raw.unlockedAtMs) return;
  if (Date.now() >= raw.expiresAtMs) {
    await clearPersistedExtVaultSession();
    return;
  }
  try {
    await s.hydrateFromMasterKeyRaw(b64ToBytes(raw.masterKeyB64), raw.scopes, raw.unlockedAtMs);
  } catch {
    await clearPersistedExtVaultSession();
  }
}
