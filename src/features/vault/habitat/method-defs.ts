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
  vaultHistoryListInputSchema,
  vaultHistoryListOutputSchema,
  vaultHistoryRestoreInputSchema,
  vaultHistoryRestoreOutputSchema,
  vaultListInputSchema,
  vaultListOutputSchema,
  vaultPatchInputSchema,
  vaultPatchOutputSchema,
  vaultPatchPlainInputSchema,
  vaultPatchPlainOutputSchema,
  vaultSearchInputSchema,
  vaultSearchOutputSchema,
  vaultTouchInputSchema,
  vaultTouchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/vault";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const vaultMethodDefs = {
  "vault.list": defineHabitatMethod({
    input: vaultListInputSchema,
    output: vaultListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.get": defineHabitatMethod({
    input: vaultGetInputSchema,
    output: vaultGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.create": defineHabitatMethod({
    input: vaultCreateInputSchema,
    output: vaultCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.createPlain": defineHabitatMethod({
    input: vaultCreatePlainInputSchema,
    output: vaultCreatePlainOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.patch": defineHabitatMethod({
    input: vaultPatchInputSchema,
    output: vaultPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.patchPlain": defineHabitatMethod({
    input: vaultPatchPlainInputSchema,
    output: vaultPatchPlainOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.touch": defineHabitatMethod({
    input: vaultTouchInputSchema,
    output: vaultTouchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.delete": defineHabitatMethod({
    input: vaultDeleteInputSchema,
    output: vaultDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.search": defineHabitatMethod({
    input: vaultSearchInputSchema,
    output: vaultSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.history.list": defineHabitatMethod({
    input: vaultHistoryListInputSchema,
    output: vaultHistoryListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.history.restore": defineHabitatMethod({
    input: vaultHistoryRestoreInputSchema,
    output: vaultHistoryRestoreOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.crypto.get": defineHabitatMethod({
    input: vaultCryptoGetInputSchema,
    output: vaultCryptoGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "vault.crypto.init": defineHabitatMethod({
    input: vaultCryptoInitInputSchema,
    output: vaultCryptoInitOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.crypto.change": defineHabitatMethod({
    input: vaultCryptoChangeInputSchema,
    output: vaultCryptoChangeOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "vault.ensureAgent": defineHabitatMethod({
    input: vaultEnsureAgentInputSchema,
    output: vaultEnsureAgentOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
