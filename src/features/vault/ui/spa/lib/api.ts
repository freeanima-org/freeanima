import type {
  VaultConfigRowPayload,
  VaultCreateInput,
  VaultCreatePlainInput,
  VaultGetOutput,
  VaultItemDetailRowPayload,
  VaultItemMetaRowPayload,
  VaultListOutput,
  VaultPatchInput,
  VaultPatchPlainInput,
  VaultSecretsViewPayload,
} from "@freeanima/shared/rpc-contract";
import type { SubjectKind } from "@freeanima/frontend/portal-sdk";
import { getTypedHabitatClient } from "@freeanima/platform/habitat/client.ts";

type VaultRpcMethod =
  | "vault.list"
  | "vault.get"
  | "vault.search"
  | "vault.create"
  | "vault.createPlain"
  | "vault.patch"
  | "vault.patchPlain"
  | "vault.delete"
  | "vault.crypto.get"
  | "vault.crypto.init"
  | "vault.crypto.change"
  | "vault.ensureAgent";

async function vaultRequest<T>(
  method: VaultRpcMethod,
  payload: Record<string, unknown>,
): Promise<T> {
  return getTypedHabitatClient().call(method as never, payload as never) as Promise<T>;
}

export async function fetchVaultItems(
  subjectKind: SubjectKind,
  opts?: { limit?: number; query?: string },
): Promise<VaultItemMetaRowPayload[]> {
  if (opts?.query?.trim()) {
    const data = await vaultRequest<{ items: VaultItemMetaRowPayload[] }>("vault.search", {
      subject_kind: subjectKind,
      query: opts.query.trim(),
      limit: opts.limit ?? 200,
    });
    return data.items;
  }
  const data = await vaultRequest<VaultListOutput>("vault.list", {
    subject_kind: subjectKind,
    limit: opts?.limit ?? 200,
  });
  return data.items;
}

export async function getVaultItem(
  subjectKind: SubjectKind,
  id: number,
  includeSecrets = false,
): Promise<VaultItemDetailRowPayload> {
  const data = await vaultRequest<VaultGetOutput>("vault.get", {
    subject_kind: subjectKind,
    id,
    include_secrets: includeSecrets,
  });
  return data.item;
}

export async function createVaultItem(
  subjectKind: SubjectKind,
  input: Omit<VaultCreateInput, "subject_kind">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.create", {
    subject_kind: subjectKind,
    ...input,
  });
  return data.item;
}

export async function createVaultItemPlain(
  input: Omit<VaultCreatePlainInput, "subject_kind">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.createPlain", {
    subject_kind: "agent",
    ...input,
  });
  return data.item;
}

export async function patchVaultItem(
  subjectKind: SubjectKind,
  input: Omit<VaultPatchInput, "subject_kind">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.patch", {
    subject_kind: subjectKind,
    ...input,
  });
  return data.item;
}

export async function patchVaultItemPlain(
  input: Omit<VaultPatchPlainInput, "subject_kind">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.patchPlain", {
    subject_kind: "agent",
    ...input,
  });
  return data.item;
}

export async function deleteVaultItem(subjectKind: SubjectKind, id: number): Promise<void> {
  await vaultRequest("vault.delete", { subject_kind: subjectKind, id });
}

export async function getVaultCryptoConfig(
  subjectKind: SubjectKind,
): Promise<VaultConfigRowPayload | null> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload | null }>("vault.crypto.get", {
    subject_kind: subjectKind,
  });
  return data.config;
}

export async function initVaultCryptoConfig(
  subjectKind: SubjectKind,
  input: { salt: string; verifier: string },
): Promise<VaultConfigRowPayload> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload }>("vault.crypto.init", {
    subject_kind: subjectKind,
    salt: input.salt,
    verifier: input.verifier,
  });
  return data.config;
}

export async function changeVaultCryptoConfig(input: {
  salt: string;
  verifier: string;
  rewrapped: Array<{ id: number; dek_wrapped: string }>;
}): Promise<void> {
  await vaultRequest("vault.crypto.change", {
    subject_kind: "user",
    salt: input.salt,
    verifier: input.verifier,
    rewrapped: input.rewrapped,
  });
}

/** User 改密用：列出带 dek_wrapped 的条目（不含解密明文） */
export async function fetchVaultWrappedDeks(
  subjectKind: SubjectKind,
): Promise<Array<{ id: number; dek_wrapped: string }>> {
  const data = await vaultRequest<VaultListOutput>("vault.list", {
    subject_kind: subjectKind,
    limit: 10_000,
    include_secrets: true,
  });
  return data.items
    .filter(
      (item): item is typeof item & { dek_wrapped: string } =>
        typeof item.dek_wrapped === "string" && item.dek_wrapped.length > 0,
    )
    .map((item) => ({ id: item.id, dek_wrapped: item.dek_wrapped }));
}

export async function ensureAgentVaultConfig(): Promise<VaultConfigRowPayload> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload }>("vault.ensureAgent", {});
  return data.config;
}

export type { VaultSecretsViewPayload, VaultItemMetaRowPayload, VaultItemDetailRowPayload };
