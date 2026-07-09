import { ensureVaultConfig, getVaultConfig } from "@freeanima/features/vault/domain/config-store";
import { getVaultItem, updateVaultItem } from "@freeanima/features/vault/domain/item-store";
import { resolveVaultWorldId } from "@freeanima/features/vault/domain/vault-world";
import {
  extractCustomFieldNames,
  openVaultSecrets,
  sealVaultSecrets,
  type VaultSecretsPayload,
} from "@freeanima/shared/vault-crypto";

import { getAgentMachineKey } from "./machine-key.ts";

export async function ensureAgentVaultConfig(
  worldId: number = resolveVaultWorldId("agent"),
): Promise<NonNullable<Awaited<ReturnType<typeof getVaultConfig>>>> {
  await getAgentMachineKey();
  const existing = await getVaultConfig(worldId);
  if (existing?.mode === "machine") return existing;
  return ensureVaultConfig(worldId, {
    mode: "machine",
    key_id: "agent-machine",
  });
}

export async function sealAgentVaultItem(
  secrets: VaultSecretsPayload,
): Promise<{ secrets_enc: string; dek_wrapped: string; custom_field_names: string[] }> {
  await ensureAgentVaultConfig();
  const key = await getAgentMachineKey();
  const sealed = await sealVaultSecrets(secrets, key);
  return {
    ...sealed,
    custom_field_names: extractCustomFieldNames(secrets),
  };
}

export async function openAgentVaultSecrets(
  secrets_enc: string,
  dek_wrapped: string,
): Promise<VaultSecretsPayload> {
  await ensureAgentVaultConfig();
  const key = await getAgentMachineKey();
  return openVaultSecrets(secrets_enc, dek_wrapped, key);
}

export async function resolveAgentVaultSecret(
  worldId: number,
  itemId: number,
  field: string,
): Promise<string> {
  await ensureAgentVaultConfig(worldId);
  const item = await getVaultItem(worldId, itemId, { include_secrets: true });
  if (!item || !("secrets_enc" in item) || !("dek_wrapped" in item)) {
    throw new Error("NOT_FOUND");
  }
  const secrets = await openAgentVaultSecrets(item.secrets_enc, item.dek_wrapped);
  const { resolveSecretField } = await import("@freeanima/shared/vault-crypto");
  const value = resolveSecretField(secrets, field);
  if (value == null) throw new Error("FIELD_NOT_FOUND");
  return value;
}

export async function patchAgentVaultSecrets(
  worldId: number,
  itemId: number,
  secrets: VaultSecretsPayload,
): Promise<void> {
  const sealed = await sealAgentVaultItem(secrets);
  const updated = await updateVaultItem(worldId, {
    id: itemId,
    secrets_enc: sealed.secrets_enc,
    dek_wrapped: sealed.dek_wrapped,
    custom_field_names: sealed.custom_field_names,
  });
  if (!updated) throw new Error("NOT_FOUND");
}
