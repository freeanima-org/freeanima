import {
  UserVaultSession,
  VAULT_UI_SCOPE,
} from "@freeanima/client/portal-sdk/vault/user-vault-session.ts";

const EXT_SCOPE = "__vault_ext__";

let session: UserVaultSession | null = null;

export function getExtVaultSession(): UserVaultSession {
  if (!session) {
    session = new UserVaultSession();
    session.configure({ timeoutMs: 15 * 60 * 1000 });
  }
  return session;
}

export { EXT_SCOPE, VAULT_UI_SCOPE };

export function isExtVaultUnlocked(): boolean {
  return getExtVaultSession().isUnlocked(EXT_SCOPE);
}
