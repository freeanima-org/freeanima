import type { SubjectKind } from "@freeanima/habitat/core/config";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import { resolveDefaultPrivateWorldForSubject } from "@freeanima/habitat/core/db/pg/entity";
import type { VaultItemType } from "@freeanima/habitat/core/db/schema/entity";
import {
  createVaultItem,
  deleteVaultItem,
  getVaultItem,
  listVaultItemRevisions,
  listVaultItems,
  listVaultItemsWithWrappedDek,
  restoreVaultItemRevision,
  searchVaultItems,
  toVaultItemMeta,
  touchVaultItemLastUsed,
  updateVaultItem,
  type VaultItemMetaRow,
  type VaultItemRow,
} from "../domain/item-store.ts";
import { ensureVaultConfig, getVaultConfig, updateVaultConfig } from "../domain/config-store.ts";
import { resolveVaultWorldId } from "../domain/vault-world.ts";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import type { VaultSecretsPayload } from "@freeanima/shared/vault-crypto";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { getEntity, updateEntity } from "@freeanima/habitat/core/db/pg/entity";
import type { RuntimeDeps } from "./runtime-deps.ts";

async function loadAgentVaultConnector() {
  return import("@freeanima/habitat/capabilities/connectors/vault");
}

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: RpcRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  // 单实例 Habitat：user token 可读写 agent 库（machine key，Shell /vault Agent 页）
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind: SubjectKind | undefined): SubjectKind {
  if (subject_kind !== "user" && subject_kind !== "agent") {
    throw new Error("subject_kind is required (user|agent)");
  }
  return subject_kind;
}

async function vaultWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveVaultWorldId(kind);
}

function toMetaPayload(row: VaultItemMetaRow | VaultItemRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    item_type: row.item_type,
    ...(row.url !== undefined ? { url: row.url } : {}),
    ...(row.uris !== undefined ? { uris: row.uris } : {}),
    ...(row.username !== undefined ? { username: row.username } : {}),
    ...(row.last_used_at !== undefined ? { last_used_at: row.last_used_at } : {}),
    tag_ids: row.tag_ids,
    custom_field_names: row.custom_field_names,
    ...(row.import_refs !== undefined ? { import_refs: row.import_refs } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toConfigPayload(config: NonNullable<Awaited<ReturnType<typeof getVaultConfig>>>) {
  return {
    id: config.id,
    mode: config.mode,
    kdf: config.kdf,
    salt: config.salt,
    verifier: config.verifier,
    key_id: config.key_id,
  };
}

export async function serviceVaultList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    tag_ids?: number[];
    limit?: number;
    include_secrets?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await vaultWorldIdForAuth(auth, input.subject_kind);
  const items = await listVaultItems(
    worldId,
    omitUndefined({
      tag_ids: input.tag_ids,
      limit: input.limit,
      include_secrets: input.include_secrets,
    }),
  );
  if (!input.include_secrets) {
    return { items: items.map((row) => toMetaPayload(row)) };
  }
  const wrapped = await listVaultItemsWithWrappedDek(worldId);
  const revisionById = new Map(wrapped.map((w) => [w.id, w.revision_deks] as const));
  return {
    items: items.map((row) => {
      if (!("secrets_enc" in row)) return toMetaPayload(row);
      return {
        ...row,
        revision_deks: revisionById.get(row.id) ?? [],
      };
    }),
  };
}

export async function serviceVaultGet(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; include_secrets?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = resolveSubjectKind(input.subject_kind);
  const worldId = await vaultWorldIdForAuth(auth, kind);
  const item = await getVaultItem(
    worldId,
    input.id,
    omitUndefined({ include_secrets: input.include_secrets }),
  );
  if (!item) throw new Error("NOT_FOUND");

  if (!input.include_secrets) {
    return { item: toMetaPayload(item) };
  }

  if (!("secrets_enc" in item) || !("dek_wrapped" in item)) {
    throw new Error("NOT_FOUND");
  }

  if (kind === "agent") {
    const { openAgentVaultSecrets } = await loadAgentVaultConnector();
    const secrets = await openAgentVaultSecrets(item.secrets_enc, item.dek_wrapped);
    return { item: { ...toMetaPayload(item), secrets } };
  }

  return {
    item: {
      ...toMetaPayload(item),
      secrets_enc: item.secrets_enc,
      dek_wrapped: item.dek_wrapped,
    },
  };
}

export async function serviceVaultCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    content?: string;
    item_type?: VaultItemType;
    url?: string;
    uris?: VaultItemRow["uris"];
    username?: string;
    tag_ids?: number[];
    secrets_enc: string;
    dek_wrapped: string;
    custom_field_names?: string[];
    import_refs?: VaultItemRow["import_refs"];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createVaultItem(
    await vaultWorldIdForAuth(auth, subject_kind),
    omitUndefined(createInput),
  );
  return { item: toMetaPayload(item) };
}

export async function serviceVaultCreatePlain(
  deps: RuntimeDeps,
  input: {
    subject_kind?: "agent";
    title: string;
    content?: string;
    item_type?: VaultItemType;
    url?: string;
    uris?: VaultItemRow["uris"];
    username?: string;
    tag_ids?: number[];
    secrets: VaultSecretsPayload;
    import_refs?: VaultItemRow["import_refs"];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = resolveSubjectKind(input.subject_kind);
  assertSubjectKindMatches(auth, kind);
  const worldId = resolveVaultWorldId(kind);
  const { ensureAgentVaultConfig, sealAgentVaultItem } = await loadAgentVaultConnector();
  await ensureAgentVaultConfig(worldId);
  const sealed = await sealAgentVaultItem(input.secrets);
  const item = await createVaultItem(
    worldId,
    omitUndefined({
      title: input.title,
      content: input.content,
      item_type: input.item_type,
      url: input.url,
      uris: input.uris,
      username: input.username,
      tag_ids: input.tag_ids,
      secrets_enc: sealed.secrets_enc,
      dek_wrapped: sealed.dek_wrapped,
      custom_field_names: sealed.custom_field_names,
      import_refs: input.import_refs,
    }),
  );
  return { item: toMetaPayload(item) };
}

export async function serviceVaultPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    content?: string;
    item_type?: VaultItemType;
    url?: string;
    uris?: VaultItemRow["uris"];
    username?: string;
    tag_ids?: number[];
    secrets_enc?: string;
    dek_wrapped?: string;
    custom_field_names?: string[];
    import_refs?: VaultItemRow["import_refs"];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateVaultItem(
    await vaultWorldIdForAuth(auth, subject_kind),
    omitUndefined({ id, ...patch }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item: toMetaPayload(item) };
}

export async function serviceVaultTouch(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await touchVaultItemLastUsed(
    await vaultWorldIdForAuth(auth, input.subject_kind),
    input.id,
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item: toMetaPayload(item) };
}

export async function serviceVaultPatchPlain(
  deps: RuntimeDeps,
  input: {
    subject_kind?: "agent";
    id: number;
    title?: string;
    content?: string;
    item_type?: VaultItemType;
    url?: string;
    uris?: VaultItemRow["uris"];
    username?: string;
    tag_ids?: number[];
    secrets?: VaultSecretsPayload;
    import_refs?: VaultItemRow["import_refs"];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = resolveSubjectKind(input.subject_kind);
  assertSubjectKindMatches(auth, kind);
  const worldId = resolveVaultWorldId(kind);
  const { ensureAgentVaultConfig, openAgentVaultSecrets, sealAgentVaultItem } =
    await loadAgentVaultConnector();
  await ensureAgentVaultConfig(worldId);

  const { id, subject_kind: _kind, secrets, ...metaPatch } = input;
  const patch: Parameters<typeof updateVaultItem>[1] = omitUndefined({ id, ...metaPatch });

  if (secrets) {
    const existing = await getVaultItem(worldId, id, { include_secrets: true });
    if (!existing || !("secrets_enc" in existing)) throw new Error("NOT_FOUND");
    let merged: VaultSecretsPayload;
    if (existing.secrets_enc && existing.dek_wrapped) {
      const current = await openAgentVaultSecrets(existing.secrets_enc, existing.dek_wrapped);
      merged = { ...current, ...secrets };
    } else {
      merged = secrets;
    }
    const sealed = await sealAgentVaultItem(merged);
    patch.secrets_enc = sealed.secrets_enc;
    patch.dek_wrapped = sealed.dek_wrapped;
    patch.custom_field_names = sealed.custom_field_names;
  }

  const item = await updateVaultItem(worldId, patch);
  if (!item) throw new Error("NOT_FOUND");
  return { item: toMetaPayload(item) };
}

export async function serviceVaultDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteVaultItem(await vaultWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceVaultSearch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    query: string;
    limit?: number;
    include_secrets?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await vaultWorldIdForAuth(auth, input.subject_kind);
  const items = await searchVaultItems(
    worldId,
    input.query,
    omitUndefined({ limit: input.limit, include_secrets: input.include_secrets }),
  );
  return { items: items.map((row) => toMetaPayload(row)) };
}

export async function serviceVaultHistoryList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const revisions = await listVaultItemRevisions(
    await vaultWorldIdForAuth(auth, input.subject_kind),
    input.id,
  );
  if (!revisions) throw new Error("NOT_FOUND");
  return { revisions };
}

export async function serviceVaultHistoryRestore(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; revision_index: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await restoreVaultItemRevision(
    await vaultWorldIdForAuth(auth, input.subject_kind),
    input.id,
    input.revision_index,
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item: toMetaPayload(item) };
}

export async function serviceVaultCryptoGet(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await vaultWorldIdForAuth(auth, input.subject_kind);
  const config = await getVaultConfig(worldId);
  return { config: config ? toConfigPayload(config) : null };
}

export async function serviceVaultCryptoInit(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    salt: string;
    verifier: string;
    kdf?: { name: string; iterations?: number };
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = resolveSubjectKind(input.subject_kind);
  if (kind === "agent") {
    throw new Error("AGENT_VAULT_USE_MACHINE_KEY");
  }
  const worldId = await vaultWorldIdForAuth(auth, kind);
  const existing = await getVaultConfig(worldId);
  if (existing) throw new Error("VAULT_CONFIG_EXISTS");
  const config = await ensureVaultConfig(worldId, {
    mode: "master_password",
    salt: input.salt,
    verifier: input.verifier,
    kdf: input.kdf,
  });
  return { config: toConfigPayload(config) };
}

export async function serviceVaultCryptoChange(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind | undefined;
    salt?: string | undefined;
    verifier: string;
    rewrapped: Array<{
      id: number;
      dek_wrapped: string;
      revision_deks?: string[] | undefined;
    }>;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = resolveSubjectKind(input.subject_kind);
  if (kind === "agent") {
    throw new Error("AGENT_VAULT_USE_MACHINE_KEY");
  }
  const worldId = await vaultWorldIdForAuth(auth, kind);
  const existing = await getVaultConfig(worldId);
  if (!existing || existing.mode !== "master_password") {
    throw new Error("VAULT_CONFIG_NOT_FOUND");
  }
  await updateVaultConfig(
    worldId,
    omitUndefined({
      salt: input.salt,
      verifier: input.verifier,
    }),
  );
  for (const row of input.rewrapped) {
    const entity = await getEntity(row.id);
    if (!entity) throw new Error("NOT_FOUND");
    const revision_deks = row.revision_deks ?? [];
    const nextRevisions = entity.revisions.map((rev, index) => {
      const nextDek = revision_deks[index];
      if (nextDek === undefined) return rev;
      return {
        ...rev,
        body: { ...rev.body, dek_wrapped: nextDek },
      };
    });
    const updated = await updateEntity({
      id: row.id,
      body: { dek_wrapped: row.dek_wrapped },
      revisions: nextRevisions,
      skip_revision: true,
    });
    if (!updated) throw new Error("NOT_FOUND");
  }
  return { ok: true as const };
}

export async function serviceVaultEnsureAgent(
  deps: RuntimeDeps,
  _input: Record<string, never>,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  if (auth.subject_type !== "user" && auth.subject_type !== "agent") {
    throw new Error("FORBIDDEN_SUBJECT");
  }
  const worldId = resolveVaultWorldId("agent");
  const { ensureAgentVaultConfig } = await loadAgentVaultConnector();
  const config = await ensureAgentVaultConfig(worldId);
  return { config: toConfigPayload(config) };
}

function assertUserOrAgentToken(auth: VerifiedServiceApiToken): void {
  if (auth.subject_type !== "user" && auth.subject_type !== "agent") {
    throw new Error("FORBIDDEN_SUBJECT");
  }
}

export async function serviceVaultAgentKeyStatus(
  deps: RuntimeDeps,
  _input: Record<string, never>,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  assertUserOrAgentToken(auth);
  const { isAgentVaultUnlocked } = await loadAgentVaultConnector();
  return {
    unlocked: isAgentVaultUnlocked(),
    custody: "user_vault" as const,
  };
}

export async function serviceVaultAgentKeyProvision(
  deps: RuntimeDeps,
  input: { key_b64: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  assertUserOrAgentToken(auth);
  const { provisionAgentMachineKeyB64, ensureAgentVaultConfig } = await loadAgentVaultConnector();
  await ensureAgentVaultConfig(resolveVaultWorldId("agent"));
  await provisionAgentMachineKeyB64(input.key_b64);
  return { unlocked: true as const };
}

export async function serviceVaultAgentKeyLock(
  deps: RuntimeDeps,
  _input: Record<string, never>,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  assertUserOrAgentToken(auth);
  const { lockAgentMachineKey } = await loadAgentVaultConnector();
  lockAgentMachineKey();
  return { unlocked: false as const };
}

export async function serviceVaultAgentKeyPeekRaw(
  deps: RuntimeDeps,
  _input: Record<string, never>,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  assertUserOrAgentToken(auth);
  const { peekAgentMachineKeyB64 } = await loadAgentVaultConnector();
  return { key_b64: peekAgentMachineKeyB64() };
}

export { listVaultItemsWithWrappedDek, toVaultItemMeta, resolveDefaultPrivateWorldForSubject };
