import {
  VAULT_CONFIG_COMPONENT,
  asVaultConfig,
  type VaultConfigBody,
} from "@freeanima/core/db/schema/entity";
import { createEntity, getEntity, listEntities, updateEntity } from "@freeanima/core/db/pg/entity";

const CONFIG_TITLE = "__vault_config__";

export async function getVaultConfig(
  worldId: number,
): Promise<(VaultConfigBody & { id: number }) | null> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: VAULT_CONFIG_COMPONENT,
    limit: 1,
  });
  const row = rows[0];
  if (!row) return null;
  const parsed = asVaultConfig(row);
  return parsed;
}

export async function ensureVaultConfig(
  worldId: number,
  body: VaultConfigBody,
): Promise<VaultConfigBody & { id: number }> {
  const existing = await getVaultConfig(worldId);
  if (existing) return existing;
  const created = await createEntity({
    type: "content",
    world_id: worldId,
    components: [VAULT_CONFIG_COMPONENT],
    primary_component: VAULT_CONFIG_COMPONENT,
    title: CONFIG_TITLE,
    body,
  });
  const parsed = asVaultConfig(created);
  if (!parsed) throw new Error("failed to create vault_config");
  return parsed;
}

export async function updateVaultConfig(
  worldId: number,
  patch: Partial<VaultConfigBody>,
): Promise<VaultConfigBody & { id: number }> {
  const existing = await getVaultConfig(worldId);
  if (!existing) throw new Error("vault_config not found");
  const row = await getEntity(existing.id);
  if (!row || row.world_id !== worldId) throw new Error("vault_config not found");
  const { id, ...currentBody } = existing;
  const nextBody = { ...currentBody, ...patch };
  const updated = await updateEntity({ id, body: nextBody });
  if (!updated) throw new Error("vault_config not found");
  const parsed = asVaultConfig(updated);
  if (!parsed) throw new Error("invalid vault_config body");
  return parsed;
}
