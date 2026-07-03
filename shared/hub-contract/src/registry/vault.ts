import {
  vaultCreateInputSchema,
  vaultCreateOutputSchema,
  vaultCreatePlainInputSchema,
  vaultCreatePlainOutputSchema,
  vaultCryptoChangeInputSchema,
  vaultCryptoChangeOutputSchema,
  vaultCryptoGetInputSchema,
  vaultCryptoGetOutputSchema,
  vaultCryptoInitInputSchema,
  vaultCryptoInitOutputSchema,
  vaultDeleteInputSchema,
  vaultDeleteOutputSchema,
  vaultEnsureAgentInputSchema,
  vaultEnsureAgentOutputSchema,
  vaultGetInputSchema,
  vaultGetOutputSchema,
  vaultListInputSchema,
  vaultListOutputSchema,
  vaultPatchInputSchema,
  vaultPatchOutputSchema,
  vaultPatchPlainInputSchema,
  vaultPatchPlainOutputSchema,
  vaultSearchInputSchema,
  vaultSearchOutputSchema,
} from "@freeanima/sap-contract/frames/vault";

import { defineHubMethod, dualCrudMeta } from "../method-def.ts";

export const vaultMethodDefs = {
  "vault.list": defineHubMethod({
    input: vaultListInputSchema,
    output: vaultListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "vault.get": defineHubMethod({
    input: vaultGetInputSchema,
    output: vaultGetOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "vault.create": defineHubMethod({
    input: vaultCreateInputSchema,
    output: vaultCreateOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.createPlain": defineHubMethod({
    input: vaultCreatePlainInputSchema,
    output: vaultCreatePlainOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.patch": defineHubMethod({
    input: vaultPatchInputSchema,
    output: vaultPatchOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.patchPlain": defineHubMethod({
    input: vaultPatchPlainInputSchema,
    output: vaultPatchPlainOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.delete": defineHubMethod({
    input: vaultDeleteInputSchema,
    output: vaultDeleteOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.search": defineHubMethod({
    input: vaultSearchInputSchema,
    output: vaultSearchOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "vault.crypto.get": defineHubMethod({
    input: vaultCryptoGetInputSchema,
    output: vaultCryptoGetOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "vault.crypto.init": defineHubMethod({
    input: vaultCryptoInitInputSchema,
    output: vaultCryptoInitOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.crypto.change": defineHubMethod({
    input: vaultCryptoChangeInputSchema,
    output: vaultCryptoChangeOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "vault.ensureAgent": defineHubMethod({
    input: vaultEnsureAgentInputSchema,
    output: vaultEnsureAgentOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
} as const;
