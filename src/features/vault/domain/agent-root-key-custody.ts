import { getUserVaultSession, VAULT_UI_SCOPE } from "@freeanima/client/portal-sdk/react.tsx";
import {
  AGENT_ROOT_KEY_ITEM_TITLE,
  AGENT_ROOT_KEY_REF,
  AGENT_ROOT_KEY_SECRET_FIELD,
} from "@freeanima/features/vault/domain/agent-root-key.ts";
import {
  createVaultItem,
  fetchVaultItems,
  getVaultItem,
  lockAgentVaultKey,
  peekAgentVaultKeyRaw,
  provisionAgentVaultKey,
} from "@freeanima/features/vault/ui/spa/lib/api.ts";
import { extractCustomFieldNames } from "@freeanima/shared/vault-crypto";

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function generateKeyB64(): string {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return bytesToB64(raw);
}

async function findAgentRootKeyItemId(): Promise<number | null> {
  const items = await fetchVaultItems("user", { limit: 500 });
  const existing = items.find((row) => row.import_refs?.agent_root_key === AGENT_ROOT_KEY_REF);
  return existing?.id ?? null;
}

async function readSsotKeyB64(itemId: number): Promise<string> {
  const session = getUserVaultSession();
  const detail = await getVaultItem("user", itemId, true);
  if (!detail.secrets_enc || !detail.dek_wrapped) {
    throw new Error("AGENT_ROOT_KEY_CIPHERTEXT_MISSING");
  }
  const secrets = await session.openSecrets(detail.secrets_enc, detail.dek_wrapped);
  const value = secrets[AGENT_ROOT_KEY_SECRET_FIELD];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("AGENT_ROOT_KEY_MISSING");
  }
  return value;
}

async function sealSsotItem(keyB64: string): Promise<void> {
  const session = getUserVaultSession();
  const secrets = {
    [AGENT_ROOT_KEY_SECRET_FIELD]: keyB64,
    notes: "System: Habitat Agent vault root key (do not delete).",
  };
  const sealed = await session.sealSecrets(secrets);
  await createVaultItem("user", {
    title: AGENT_ROOT_KEY_ITEM_TITLE,
    item_type: "secure_note",
    content: "",
    secrets_enc: sealed.secrets_enc,
    dek_wrapped: sealed.dek_wrapped,
    custom_field_names: extractCustomFieldNames(secrets),
    import_refs: { agent_root_key: AGENT_ROOT_KEY_REF },
  });
}

/**
 * 若 Habitat 仍有缓存而 User 库尚无 SSOT，则迁入（避免锁定后误生成新钥）。
 * 要求 User 库已解锁。
 */
export async function migrateAgentRootKeySsotIfNeeded(): Promise<boolean> {
  const session = getUserVaultSession();
  if (!session.isUnlocked(VAULT_UI_SCOPE)) {
    throw new Error("vault_locked");
  }
  const existingId = await findAgentRootKeyItemId();
  if (existingId != null) return false;
  const peeked = await peekAgentVaultKeyRaw();
  if (!peeked.key_b64) return false;
  await sealSsotItem(peeked.key_b64);
  return true;
}

/**
 * 从 User 库 SSOT 播种 Habitat Agent 缓存；无 SSOT 时迁入现有缓存或新生成。
 * 要求 User 库已解锁。
 */
export async function unlockAgentVaultFromUserCustody(): Promise<void> {
  const session = getUserVaultSession();
  if (!session.isUnlocked(VAULT_UI_SCOPE)) {
    throw new Error("vault_locked");
  }

  let keyB64: string;
  const existingId = await findAgentRootKeyItemId();
  if (existingId != null) {
    keyB64 = await readSsotKeyB64(existingId);
  } else {
    const peeked = await peekAgentVaultKeyRaw();
    keyB64 = peeked.key_b64 ?? generateKeyB64();
    await sealSsotItem(keyB64);
  }

  await provisionAgentVaultKey(keyB64);
}

export async function lockAgentVaultCustody(): Promise<void> {
  await lockAgentVaultKey();
}
