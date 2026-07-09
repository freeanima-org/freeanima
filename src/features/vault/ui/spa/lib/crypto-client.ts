import {
  extractCustomFieldNames,
  randomSalt,
  sealVaultSecrets,
  type VaultSecretsPayload,
} from "@freeanima/shared/vault-crypto";
import type { VaultCreateInput, VaultPatchInput } from "@freeanima/shared/sap-contract";

export async function buildUserVaultCreatePayload(input: {
  title: string;
  content?: string;
  item_type?: VaultCreateInput["item_type"];
  url?: string;
  username?: string;
  tags?: string[];
  secrets: VaultSecretsPayload;
  masterKey: CryptoKey;
}): Promise<Pick<VaultCreateInput, "secrets_enc" | "dek_wrapped" | "custom_field_names">> {
  const sealed = await sealVaultSecrets(input.secrets, input.masterKey);
  return {
    secrets_enc: sealed.secrets_enc,
    dek_wrapped: sealed.dek_wrapped,
    custom_field_names: extractCustomFieldNames(input.secrets),
  };
}

export async function buildUserVaultPatchSecrets(input: {
  secrets: VaultSecretsPayload;
  masterKey: CryptoKey;
}): Promise<Pick<VaultPatchInput, "secrets_enc" | "dek_wrapped" | "custom_field_names">> {
  const sealed = await sealVaultSecrets(input.secrets, input.masterKey);
  return {
    secrets_enc: sealed.secrets_enc,
    dek_wrapped: sealed.dek_wrapped,
    custom_field_names: extractCustomFieldNames(input.secrets),
  };
}

export function newUserVaultSalt(): string {
  return randomSalt();
}

export type { VaultSecretsPayload };
