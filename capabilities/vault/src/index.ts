export { getVaultConfig, ensureVaultConfig, updateVaultConfig } from "./config-store.ts";

export {
  listVaultItems,
  searchVaultItems,
  getVaultItem,
  createVaultItem,
  updateVaultItem,
  deleteVaultItem,
  listVaultItemsWithWrappedDek,
  toVaultItemMeta,
  type VaultItemRow,
  type VaultItemMetaRow,
  type VaultItemCreateInput,
  type VaultItemUpdateInput,
} from "./item-store.ts";

export {
  resolveVaultWorldId,
  defaultVaultSubjectForTools,
  defaultVaultSubjectForShell,
} from "./vault-world.ts";

export { registerVaultTools, type VaultToolIo } from "./tools.ts";
