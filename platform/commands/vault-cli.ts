import { listVaultItems, toVaultItemMeta } from "@freeanima/capabilities-vault/item-store";
import { resolveVaultWorldId } from "@freeanima/capabilities-vault/vault-world";
import { resolveAgentVaultSecret } from "@freeanima/platform/connectors/vault";

export type VaultCliItem = {
  id: number;
  title: string;
  item_type: string;
  custom_field_names: string[];
};

export async function listAgentVaultCliItems(): Promise<VaultCliItem[]> {
  const worldId = resolveVaultWorldId("agent");
  const rows = await listVaultItems(worldId, { limit: 500 });
  return rows.map((row) => {
    const meta =
      "secrets_enc" in row && row.secrets_enc
        ? toVaultItemMeta(row as import("@freeanima/capabilities-vault/item-store").VaultItemRow)
        : row;
    return {
      id: meta.id,
      title: meta.title,
      item_type: meta.item_type,
      custom_field_names: meta.custom_field_names ?? [],
    };
  });
}

export async function getAgentVaultCliField(itemId: number, field: string): Promise<string> {
  const worldId = resolveVaultWorldId("agent");
  return resolveAgentVaultSecret(worldId, itemId, field);
}
