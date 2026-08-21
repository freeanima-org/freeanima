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
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";
import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
import { omitUndefined } from "@freeanima/shared/util";

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
  | "vault.ensureAgent"
  | "vault.agentKey.status"
  | "vault.agentKey.provision"
  | "vault.agentKey.lock"
  | "vault.agentKey.peekRaw";

async function vaultRequest<T>(
  method: VaultRpcMethod,
  payload: Record<string, unknown>,
): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
  return getTypedHabitatClient().call(method as never, payload as never);
}

export async function fetchVaultItems(
  subjectId: number,
  opts?: { limit?: number; query?: string; tag_ids?: number[] },
): Promise<VaultItemMetaRowPayload[]> {
  const scope = resolveHabitatCacheScope();
  const q = opts?.query?.trim();
  const tagKey = opts?.tag_ids?.length ? opts.tag_ids.join(",") : "";
  const cacheId = q
    ? `search:${subjectId}:${q}:tags:${tagKey}`
    : `list:${subjectId}:tags:${tagKey}`;
  // 仅 meta 列表；secrets 永不入 IDB（getVaultItem include_secrets 仍在线直连）
  return withOfflineCache({
    scope,
    namespace: "vault",
    id: cacheId,
    fetch: async () => {
      if (q) {
        const data = await vaultRequest<{ items: VaultItemMetaRowPayload[] }>("vault.search", {
          subject_id: subjectId,
          query: q,
          limit: opts?.limit ?? 200,
          ...(opts?.tag_ids?.length ? { tag_ids: opts.tag_ids } : {}),
        });
        return data.items;
      }
      const data = await vaultRequest<VaultListOutput>("vault.list", {
        subject_id: subjectId,
        limit: opts?.limit ?? 200,
        ...(opts?.tag_ids?.length ? { tag_ids: opts.tag_ids } : {}),
      });
      return data.items;
    },
    offlineError: "vault.list unavailable offline",
  });
}

export async function getVaultItem(
  subjectId: number,
  id: number,
  includeSecrets = false,
): Promise<VaultItemDetailRowPayload> {
  const data = await vaultRequest<VaultGetOutput>("vault.get", {
    subject_id: subjectId,
    id,
    include_secrets: includeSecrets,
  });
  return data.item;
}

export async function createVaultItem(
  subjectId: number,
  input: Omit<VaultCreateInput, "subject_id">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.create", {
    subject_id: subjectId,
    ...input,
  });
  await invalidatePortalReads(["vault"]);
  return data.item;
}

export async function createVaultItemPlain(
  subjectId: number,
  input: Omit<VaultCreatePlainInput, "subject_id">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.createPlain", {
    subject_id: subjectId,
    ...input,
  });
  return data.item;
}

export async function patchVaultItem(
  subjectId: number,
  input: Omit<VaultPatchInput, "subject_id">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.patch", {
    subject_id: subjectId,
    ...input,
  });
  return data.item;
}

export async function patchVaultItemPlain(
  subjectId: number,
  input: Omit<VaultPatchPlainInput, "subject_id">,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.patchPlain", {
    subject_id: subjectId,
    ...input,
  });
  return data.item;
}

export async function deleteVaultItem(subjectId: number, id: number): Promise<void> {
  await vaultRequest("vault.delete", { subject_id: subjectId, id });
  await invalidatePortalReads(["vault"]);
}

export async function getVaultCryptoConfig(
  subjectId: number,
): Promise<VaultConfigRowPayload | null> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload | null }>("vault.crypto.get", {
    subject_id: subjectId,
  });
  return data.config;
}

export async function initVaultCryptoConfig(
  subjectId: number,
  input: { salt: string; verifier: string },
): Promise<VaultConfigRowPayload> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload }>("vault.crypto.init", {
    subject_id: subjectId,
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
    subject_id: await getUserSubjectId(),
    salt: input.salt,
    verifier: input.verifier,
    rewrapped: input.rewrapped,
  });
}

/** User 改密用：列出带 dek_wrapped 的条目（不含解密明文） */
export async function fetchVaultWrappedDeks(
  subjectId: number,
): Promise<Array<{ id: number; dek_wrapped: string; revision_deks: string[] }>> {
  const data = await vaultRequest<VaultListOutput>("vault.list", {
    subject_id: subjectId,
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
  subjectId: number,
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
  }>("vault.history.list", { subject_id: subjectId, id });
  return data.revisions;
}

export async function restoreVaultItemHistory(
  subjectId: number,
  id: number,
  revisionIndex: number,
): Promise<VaultItemMetaRowPayload> {
  const data = await vaultRequest<{ item: VaultItemMetaRowPayload }>("vault.history.restore", {
    subject_id: subjectId,
    id,
    revision_index: revisionIndex,
  });
  return data.item;
}

export async function ensureAgentVaultConfig(
  agentSubjectId?: number,
): Promise<VaultConfigRowPayload> {
  const data = await vaultRequest<{ config: VaultConfigRowPayload }>(
    "vault.ensureAgent",
    omitUndefined({ agent_subject_id: agentSubjectId }),
  );
  return data.config;
}

export async function fetchAgentVaultKeyStatus(): Promise<{
  unlocked: boolean;
  custody: "user_vault";
}> {
  return vaultRequest("vault.agentKey.status", {});
}

export async function provisionAgentVaultKey(keyB64: string): Promise<{ unlocked: true }> {
  return vaultRequest("vault.agentKey.provision", { key_b64: keyB64 });
}

export async function lockAgentVaultKey(): Promise<{ unlocked: false }> {
  return vaultRequest("vault.agentKey.lock", {});
}

export async function peekAgentVaultKeyRaw(): Promise<{ key_b64: string | null }> {
  return vaultRequest("vault.agentKey.peekRaw", {});
}

export type { VaultSecretsViewPayload, VaultItemMetaRowPayload, VaultItemDetailRowPayload };
