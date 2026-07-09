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
} from "@freeanima/shared/sap-contract/frames/vault";

import { defineHubMethod, dualTransportMeta } from "../method-def.ts";

export const vaultMethodDefs = {
  "vault.list": defineHubMethod({
    input: vaultListInputSchema,
    output: vaultListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.get": defineHubMethod({
    input: vaultGetInputSchema,
    output: vaultGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.create": defineHubMethod({
    input: vaultCreateInputSchema,
    output: vaultCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.createPlain": defineHubMethod({
    input: vaultCreatePlainInputSchema,
    output: vaultCreatePlainOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.patch": defineHubMethod({
    input: vaultPatchInputSchema,
    output: vaultPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.patchPlain": defineHubMethod({
    input: vaultPatchPlainInputSchema,
    output: vaultPatchPlainOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.delete": defineHubMethod({
    input: vaultDeleteInputSchema,
    output: vaultDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.search": defineHubMethod({
    input: vaultSearchInputSchema,
    output: vaultSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.crypto.get": defineHubMethod({
    input: vaultCryptoGetInputSchema,
    output: vaultCryptoGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.crypto.init": defineHubMethod({
    input: vaultCryptoInitInputSchema,
    output: vaultCryptoInitOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.crypto.change": defineHubMethod({
    input: vaultCryptoChangeInputSchema,
    output: vaultCryptoChangeOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.ensureAgent": defineHubMethod({
    input: vaultEnsureAgentInputSchema,
    output: vaultEnsureAgentOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
