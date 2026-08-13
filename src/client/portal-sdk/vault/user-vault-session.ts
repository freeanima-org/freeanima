import {
  createVerifier,
  deriveMasterKey,
  importRawAesKey,
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
  rewrapped: Array<{ id: number; dek_wrapped: string; revision_deks: string[] }>;
  /** Habitat crypto.change 成功后调用，切换会话主密钥 */
  commit: () => void;
};

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export type VaultSessionTimeoutMode = "sliding" | "absolute";

export class UserVaultSession {
  private masterKey: CryptoKey | null = null;
  private timeoutMs = DEFAULT_TIMEOUT_MS;
  private timeoutMode: VaultSessionTimeoutMode = "sliding";
  /** absolute 模式：解锁时刻；sliding 不使用 */
  private unlockedAtMs = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** 已解锁 scope：VAULT_UI_SCOPE 或 conversation_id */
  private unlockedScopes = new Set<string>();
  /** 为 true 时 derive 可导出主密钥（扩展 chrome.storage.session 恢复用） */
  private extractableMasterKey = false;
  private onLocked: (() => void) | null = null;

  configure(opts: {
    timeoutMs?: number;
    timeoutMode?: VaultSessionTimeoutMode;
    extractableMasterKey?: boolean;
    onLocked?: () => void;
  }): void {
    if (opts.timeoutMs != null && opts.timeoutMs > 0) {
      this.timeoutMs = opts.timeoutMs;
    }
    if (opts.timeoutMode) {
      this.timeoutMode = opts.timeoutMode;
    }
    if (opts.extractableMasterKey != null) {
      this.extractableMasterKey = opts.extractableMasterKey;
    }
    if (opts.onLocked) {
      this.onLocked = opts.onLocked;
    }
  }

  getState(): UserVaultSessionState {
    return this.masterKey ? "unlocked" : "locked";
  }

  /** 绝对超时截止时间（未解锁或 sliding 模式返回 null） */
  getExpiresAtMs(): number | null {
    if (!this.masterKey || this.timeoutMode !== "absolute") return null;
    return this.unlockedAtMs + this.timeoutMs;
  }

  isUnlocked(scope?: string): boolean {
    if (!this.masterKey) return false;
    if (this.isAbsoluteExpired()) {
      this.lock();
      return false;
    }
    if (!scope) {
      return this.unlockedScopes.has(VAULT_UI_SCOPE) || this.unlockedScopes.size > 0;
    }
    return this.unlockedScopes.has(scope) || this.unlockedScopes.has(VAULT_UI_SCOPE);
  }

  canResolve(conversationId?: string): boolean {
    if (!this.masterKey) return false;
    if (this.isAbsoluteExpired()) {
      this.lock();
      return false;
    }
    if (conversationId) {
      return this.unlockedScopes.has(conversationId) || this.unlockedScopes.has(VAULT_UI_SCOPE);
    }
    return this.unlockedScopes.has(VAULT_UI_SCOPE);
  }

  async unlock(input: UserVaultUnlockInput): Promise<void> {
    const masterKey = await deriveMasterKey(input.masterPassword, input.salt, undefined, {
      extractable: this.extractableMasterKey,
    });
    const ok = await verifyMasterKey(masterKey, input.verifier);
    if (!ok) {
      throw new Error("vault_master_password_invalid");
    }
    this.masterKey = masterKey;
    this.unlockedAtMs = Date.now();
    const scope = input.conversationId?.trim() || VAULT_UI_SCOPE;
    this.unlockedScopes.add(scope);
    this.scheduleTimeout();
  }

  /**
   * 从已导出的主密钥恢复会话（扩展 SW 冷启动）。
   * `unlockedAtMs` 用于 absolute 超时；缺省则视为刚解锁。
   */
  async hydrateFromMasterKeyRaw(
    rawKey: Uint8Array,
    scopes: string[],
    unlockedAtMs: number = Date.now(),
  ): Promise<void> {
    const masterKey = await importRawAesKey(rawKey, {
      extractable: this.extractableMasterKey,
    });
    this.masterKey = masterKey;
    this.unlockedAtMs = unlockedAtMs;
    this.unlockedScopes = new Set(scopes.length > 0 ? scopes : [VAULT_UI_SCOPE]);
    if (this.isAbsoluteExpired()) {
      this.clearMasterKey();
      throw new Error("vault_session_expired");
    }
    this.scheduleTimeout();
  }

  /** 导出主密钥 raw（须 configure extractableMasterKey）；未解锁返回 null */
  async exportMasterKeyRaw(): Promise<Uint8Array | null> {
    if (!this.masterKey || !this.extractableMasterKey) return null;
    try {
      return new Uint8Array(await crypto.subtle.exportKey("raw", this.masterKey));
    } catch {
      return null;
    }
  }

  listUnlockedScopes(): string[] {
    return [...this.unlockedScopes];
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
    if (this.isAbsoluteExpired()) {
      this.lock();
      return;
    }
    // absolute：只重排剩余时间，不延长截止；sliding：从现在起重新计时
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
    return resolveSecretField(secrets, field);
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
    items: Array<{ id: number; dek_wrapped: string; revision_deks?: string[] }>,
  ): Promise<MasterPasswordChangePrep> {
    if (!this.masterKey) {
      throw new Error("vault_locked");
    }
    this.touchActivity();
    const salt = randomSalt();
    const newKey = await deriveMasterKey(newPassword, salt);
    const verifier = await createVerifier(newKey);
    const flat: Array<{ id: number; dek_wrapped: string }> = [];
    const layout: Array<{ id: number; revisionCount: number }> = [];
    for (const item of items) {
      flat.push({ id: item.id, dek_wrapped: item.dek_wrapped });
      const revision_deks = item.revision_deks ?? [];
      for (const dek of revision_deks) {
        flat.push({ id: item.id, dek_wrapped: dek });
      }
      layout.push({ id: item.id, revisionCount: revision_deks.length });
    }
    const flatRewrapped = await rewrapAllDekWrapped(flat, this.masterKey, newKey);
    const rewrapped: Array<{ id: number; dek_wrapped: string; revision_deks: string[] }> = [];
    let offset = 0;
    for (const entry of layout) {
      const current = flatRewrapped[offset];
      if (!current) throw new Error("vault_rewrap_mismatch");
      offset += 1;
      const revision_deks: string[] = [];
      for (let i = 0; i < entry.revisionCount; i++) {
        const rev = flatRewrapped[offset];
        if (!rev) throw new Error("vault_rewrap_mismatch");
        revision_deks.push(rev.dek_wrapped);
        offset += 1;
      }
      rewrapped.push({ id: entry.id, dek_wrapped: current.dek_wrapped, revision_deks });
    }
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

  private isAbsoluteExpired(): boolean {
    if (this.timeoutMode !== "absolute" || !this.masterKey) return false;
    return Date.now() >= this.unlockedAtMs + this.timeoutMs;
  }

  private scheduleTimeout(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    const delay =
      this.timeoutMode === "absolute"
        ? Math.max(0, this.unlockedAtMs + this.timeoutMs - Date.now())
        : this.timeoutMs;
    this.timeoutId = setTimeout(() => {
      this.lock();
    }, delay);
  }

  private clearMasterKey(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    const hadKey = this.masterKey != null;
    this.masterKey = null;
    this.unlockedAtMs = 0;
    if (hadKey) this.onLocked?.();
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
