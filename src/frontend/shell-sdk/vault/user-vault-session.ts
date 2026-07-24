import {
  createVerifier,
  deriveMasterKey,
  openVaultSecrets,
  randomSalt,
  resolveSecretField,
  rewrapAllDekWrapped,
  sealVaultSecrets,
  verifyMasterKey,
  type VaultSecretsPayload,
} from "@freeanima/shared/vault-crypto";

export const VAULT_UI_SCOPE = "__vault_ui__";

export type UserVaultUnlockInput = {
  masterPassword: string;
  salt: string;
  verifier: string;
  /** Chat 解锁时绑定 conversation_id；Vault UI 使用 VAULT_UI_SCOPE 或省略 */
  conversationId?: string;
};

export type UserVaultSessionState = "locked" | "unlocked";

export type MasterPasswordChangePrep = {
  salt: string;
  verifier: string;
  rewrapped: Array<{ id: number; dek_wrapped: string }>;
  /** Habitat crypto.change 成功后调用，切换会话主密钥 */
  commit: () => void;
};

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export class UserVaultSession {
  private masterKey: CryptoKey | null = null;
  private timeoutMs = DEFAULT_TIMEOUT_MS;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** 已解锁 scope：VAULT_UI_SCOPE 或 conversation_id */
  private unlockedScopes = new Set<string>();

  configure(opts: { timeoutMs?: number }): void {
    if (opts.timeoutMs != null && opts.timeoutMs > 0) {
      this.timeoutMs = opts.timeoutMs;
    }
  }

  getState(): UserVaultSessionState {
    return this.masterKey ? "unlocked" : "locked";
  }

  isUnlocked(scope?: string): boolean {
    if (!this.masterKey) return false;
    if (!scope) {
      return this.unlockedScopes.has(VAULT_UI_SCOPE) || this.unlockedScopes.size > 0;
    }
    return this.unlockedScopes.has(scope) || this.unlockedScopes.has(VAULT_UI_SCOPE);
  }

  canResolve(conversationId?: string): boolean {
    if (!this.masterKey) return false;
    if (conversationId) {
      return this.unlockedScopes.has(conversationId) || this.unlockedScopes.has(VAULT_UI_SCOPE);
    }
    return this.unlockedScopes.has(VAULT_UI_SCOPE);
  }

  async unlock(input: UserVaultUnlockInput): Promise<void> {
    const masterKey = await deriveMasterKey(input.masterPassword, input.salt);
    const ok = await verifyMasterKey(masterKey, input.verifier);
    if (!ok) {
      throw new Error("vault_master_password_invalid");
    }
    this.masterKey = masterKey;
    const scope = input.conversationId?.trim() || VAULT_UI_SCOPE;
    this.unlockedScopes.add(scope);
    this.scheduleTimeout();
  }

  lock(scope?: string): void {
    if (scope) {
      this.unlockedScopes.delete(scope);
      if (this.unlockedScopes.size > 0) return;
    } else {
      this.unlockedScopes.clear();
    }
    this.clearMasterKey();
  }

  touchActivity(): void {
    if (!this.masterKey) return;
    this.scheduleTimeout();
  }

  async openSecrets(secretsEnc: string, dekWrapped: string): Promise<VaultSecretsPayload> {
    if (!this.masterKey) {
      throw new Error("vault_locked");
    }
    this.touchActivity();
    return openVaultSecrets(secretsEnc, dekWrapped, this.masterKey);
  }

  async resolveSecret(
    _itemId: number,
    field: string,
    secretsEnc: string,
    dekWrapped: string,
  ): Promise<string | undefined> {
    const secrets = await this.openSecrets(secretsEnc, dekWrapped);
    return resolveSecretField(secrets as VaultSecretsPayload, field);
  }

  async sealSecrets(
    secrets: VaultSecretsPayload,
  ): Promise<{ secrets_enc: string; dek_wrapped: string }> {
    if (!this.masterKey) {
      throw new Error("vault_locked");
    }
    this.touchActivity();
    return sealVaultSecrets(secrets, this.masterKey);
  }

  /** 首次设置 User 库 crypto 参数（主密码不落盘） */
  async initCrypto(masterPassword: string, salt: string): Promise<{ verifier: string }> {
    const masterKey = await deriveMasterKey(masterPassword, salt);
    const verifier = await createVerifier(masterKey);
    return { verifier };
  }

  /** 校验当前主密码是否匹配配置（改密前确认） */
  async verifyCurrentPassword(
    masterPassword: string,
    salt: string,
    verifier: string,
  ): Promise<boolean> {
    const key = await deriveMasterKey(masterPassword, salt);
    return verifyMasterKey(key, verifier);
  }

  /**
   * 准备改密：用当前会话主密钥 unwrap，再用新主密码 wrap。
   * 须在 Habitat `vault.crypto.change` 成功后调用返回的 `commit()`。
   */
  async prepareMasterPasswordChange(
    newPassword: string,
    items: Array<{ id: number; dek_wrapped: string }>,
  ): Promise<MasterPasswordChangePrep> {
    if (!this.masterKey) {
      throw new Error("vault_locked");
    }
    this.touchActivity();
    const salt = randomSalt();
    const newKey = await deriveMasterKey(newPassword, salt);
    const verifier = await createVerifier(newKey);
    const rewrapped = await rewrapAllDekWrapped(items, this.masterKey, newKey);
    return {
      salt,
      verifier,
      rewrapped,
      commit: () => {
        this.masterKey = newKey;
        this.scheduleTimeout();
      },
    };
  }

  private scheduleTimeout(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.lock();
    }, this.timeoutMs);
  }

  private clearMasterKey(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.masterKey = null;
  }
}

let sharedSession: UserVaultSession | null = null;

export function getUserVaultSession(): UserVaultSession {
  if (!sharedSession) {
    sharedSession = new UserVaultSession();
  }
  return sharedSession;
}

export function resetUserVaultSessionForTest(): void {
  sharedSession?.lock();
  sharedSession = null;
}
