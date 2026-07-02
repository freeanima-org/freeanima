import type { SubjectKind } from "@freeanima/core/config";
import type { VerifiedServiceApiToken } from "@freeanima/core/db/pg/service-api-token";
import { resolveDefaultPrivateWorldForSubject } from "@freeanima/core/db/pg/entity";
import type { VaultItemType } from "@freeanima/core/db/schema/entity";
import {
  createVaultItem,
  deleteVaultItem,
  getVaultItem,
  listVaultItems,
  listVaultItemsWithWrappedDek,
  searchVaultItems,
  toVaultItemMeta,
  updateVaultItem,
  type VaultItemMetaRow,
  type VaultItemRow,
} from "@freeanima/capabilities-vault/item-store";
import {
  ensureVaultConfig,
  getVaultConfig,
  updateVaultConfig,
} from "@freeanima/capabilities-vault/config-store";
import {
  defaultVaultSubjectForShell,
  resolveVaultWorldId,
} from "@freeanima/capabilities-vault/vault-world";
import type { SapRequestAuthContext } from "@freeanima/sap-contract";
import type { VaultSecretsPayload } from "@freeanima/vault-crypto";
import { omitUndefined } from "@freeanima/core/util";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import {
  ensureAgentVaultConfig,
  openAgentVaultSecrets,
  sealAgentVaultItem,
} from "@freeanima/platform/connectors/vault";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: SapRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  // 单实例 Hub：user token 可读写 agent 库（machine key，Shell /vault Agent 页）
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind?: SubjectKind): SubjectKind {
  return subject_kind ?? defaultVaultSubjectForShell();
}

async function vaultWorldIdForAuth(
  auth: SapRequestAuthContext,
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
    url: row.url,
    username: row.username,
    tags: row.tags,
    custom_field_names: row.custom_field_names,
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
    tags?: string[];
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
      tags: input.tags,
      limit: input.limit,
      include_secrets: input.include_secrets,
    }),
  );
  return {
    items: items.map((row) =>
      input.include_secrets && "secrets_enc" in row ? row : toMetaPayload(row),
    ),
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
    username?: string;
    tags?: string[];
    secrets_enc: string;
    dek_wrapped: string;
    custom_field_names?: string[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createVaultItem(await vaultWorldIdForAuth(auth, subject_kind), createInput);
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
    username?: string;
    tags?: string[];
    secrets: VaultSecretsPayload;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = input.subject_kind ?? "agent";
  assertSubjectKindMatches(auth, kind);
  const worldId = resolveVaultWorldId(kind);
  await ensureAgentVaultConfig(worldId);
  const sealed = await sealAgentVaultItem(input.secrets);
  const item = await createVaultItem(
    worldId,
    omitUndefined({
      title: input.title,
      content: input.content,
      item_type: input.item_type,
      url: input.url,
      username: input.username,
      tags: input.tags,
      secrets_enc: sealed.secrets_enc,
      dek_wrapped: sealed.dek_wrapped,
      custom_field_names: sealed.custom_field_names,
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
    username?: string;
    tags?: string[];
    secrets_enc?: string;
    dek_wrapped?: string;
    custom_field_names?: string[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateVaultItem(await vaultWorldIdForAuth(auth, subject_kind), {
    id,
    ...patch,
  });
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
    username?: string;
    tags?: string[];
    secrets?: VaultSecretsPayload;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const kind = input.subject_kind ?? "agent";
  assertSubjectKindMatches(auth, kind);
  const worldId = resolveVaultWorldId(kind);
  await ensureAgentVaultConfig(worldId);

  const { id, subject_kind: _kind, secrets, ...metaPatch } = input;
  const patch: Parameters<typeof updateVaultItem>[1] = { id, ...metaPatch };

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
    subject_kind?: SubjectKind;
    salt?: string;
    verifier: string;
    rewrapped: Array<{ id: number; dek_wrapped: string }>;
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
    const updated = await updateVaultItem(worldId, {
      id: row.id,
      dek_wrapped: row.dek_wrapped,
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
  const config = await ensureAgentVaultConfig(worldId);
  return { config: toConfigPayload(config) };
}

export { listVaultItemsWithWrappedDek, toVaultItemMeta, resolveDefaultPrivateWorldForSubject };
