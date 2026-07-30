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
import type { SubjectKind } from "@freeanima/client/portal-sdk";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

type VaultRpcMethod =
  | "vault.list"
  | "vault.get"
  | "vault.search"
  | "vault.create"
  | "vault.createPlain"
  | "vault.patch"
  | "vault.patchPlain"
  | "vault.delete"
  | "vault.history.list"
  | "vault.history.restore"
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
  const scope = resolveHabitatCacheScope();
  const q = opts?.query?.trim();
  const cacheId = q ? `search:${subjectKind}:${q}` : `list:${subjectKind}`;
  // 仅 meta 列表；secrets 永不入 IDB（getVaultItem include_secrets 仍在线直连）
  return withOfflineCache({
    scope,
    namespace: "vault",
    id: cacheId,
    fetch: async () => {
      if (q) {
        const data = await vaultRequest<{ items: VaultItemMetaRowPayload[] }>("vault.search", {
          subject_kind: subjectKind,
          query: q,
          limit: opts?.limit ?? 200,
        });
        return data.items;
      }
      const data = await vaultRequest<VaultListOutput>("vault.list", {
        subject_kind: subjectKind,
        limit: opts?.limit ?? 200,
      });
      return data.items;
    },
    offlineError: "vault.list unavailable offline",
  });
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
  await invalidatePortalReads(["vault"]);
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
  await invalidatePortalReads(["vault"]);
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
  rewrapped: Array<{ id: number; dek_wrapped: string; revision_deks?: string[] }>;
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
): Promise<Array<{ id: number; dek_wrapped: string; revision_deks: string[] }>> {
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
    .map((item) => ({
      id: item.id,
      dek_wrapped: item.dek_wrapped,
      revision_deks: item.revision_deks ?? [],
    }));
}

export async function listVaultItemHistory(
  subjectKind: SubjectKind,
  id: number,
): Promise<
  Array<{
    index: number;
    captured_at: string;
    title: string;
    changed_fields: string[];
  }>
> {
  const data = await vaultRequest<{
    revisions: Array<{
      index: number;
      captured_at: string;
      title: string;
      changed_fields: string[];
    }>;
  }>("vault.history.list", { subject_kind: subjectKind, id });
  return data.revisions;
}

export async function restoreVaultItemHistory(
  subjectKind: SubjectKind,
  id: number,
  revisionIndex: number,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.history.restore", {
    subject_kind: subjectKind,
    id,
    revision_index: revisionIndex,
  });
  return data.item;
}

export async function ensureAgentVaultConfig(): Promise<VaultConfigRowPayload> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload }>("vault.ensureAgent", {});
  return data.config;
}

export type { VaultSecretsViewPayload, VaultItemMetaRowPayload, VaultItemDetailRowPayload };
