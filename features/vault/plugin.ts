import {
  handleVaultList,
  handleVaultGet,
  handleVaultCreate,
  handleVaultCreatePlain,
  handleVaultPatch,
  handleVaultPatchPlain,
  handleVaultDelete,
  handleVaultSearch,
  handleVaultCryptoGet,
  handleVaultCryptoInit,
  handleVaultCryptoChange,
  handleVaultEnsureAgent,
} from "./hub/rpc.ts";

/** Vault feature plugin — registered by platform at boot. */
export const vaultPlugin = {
  id: "vault",
  shell: {
    routes: [{ path: "/vault", featureId: "vault", navLabel: "Vault" }],
  },
  hub: {
    rpc: {
      "vault.list": handleVaultList,
      "vault.get": handleVaultGet,
      "vault.create": handleVaultCreate,
      "vault.createPlain": handleVaultCreatePlain,
      "vault.patch": handleVaultPatch,
      "vault.patchPlain": handleVaultPatchPlain,
      "vault.delete": handleVaultDelete,
      "vault.search": handleVaultSearch,
      "vault.crypto.get": handleVaultCryptoGet,
      "vault.crypto.init": handleVaultCryptoInit,
      "vault.crypto.change": handleVaultCryptoChange,
      "vault.ensureAgent": handleVaultEnsureAgent,
    },
  },
} as const;
