export { getVaultConfig, ensureVaultConfig, updateVaultConfig } from "./config-store.ts";

export {
  listVaultItems,
  searchVaultItems,
  getVaultItem,
  createVaultItem,
  updateVaultItem,
  deleteVaultItem,
  listVaultItemsWithWrappedDek,
  listVaultItemRevisions,
  restoreVaultItemRevision,
  toVaultItemMeta,
  type VaultItemRow,
  type VaultItemMetaRow,
  type VaultItemCreateInput,
  type VaultItemUpdateInput,
  type VaultItemRevisionMeta,
  type VaultWrappedDekRow,
} from "./item-store.ts";

export {
  diffVaultRevisionFields,
  vaultCompareViewFromEntity,
  vaultCompareViewFromRevision,
  type VaultRevisionChangedField,
  type VaultRevisionCompareView,
} from "./revision-diff.ts";

export { resolveVaultWorldId } from "./vault-world.ts";

export { registerVaultTools } from "./tools.ts";
