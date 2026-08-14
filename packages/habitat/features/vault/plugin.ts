/** Vault feature plugin — registered by platform at boot. */
export const vaultPlugin = {
  id: "vault",
  shell: {
    routes: [{ path: "/vault", featureId: "vault", navLabel: "Vault" }],
  },
  habitat: {},
} as const;
