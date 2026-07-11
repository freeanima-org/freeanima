import { omitUndefined } from "@freeanima/core/util";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
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

import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type VaultSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): VaultSapServerDeps {
  return deps as VaultSapServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as SapRequestContext).auth;
}

const routes = [
  defineHubRoute({
    method: "vault.list",
    input: vaultListInputSchema,
    output: vaultListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceVaultList(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.get",
    input: vaultGetInputSchema,
    output: vaultGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceVaultGet(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.create",
    input: vaultCreateInputSchema,
    output: vaultCreateOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultCreate(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.createPlain",
    input: vaultCreatePlainInputSchema,
    output: vaultCreatePlainOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultCreatePlain(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.patch",
    input: vaultPatchInputSchema,
    output: vaultPatchOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultPatch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.patchPlain",
    input: vaultPatchPlainInputSchema,
    output: vaultPatchPlainOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultPatchPlain(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.delete",
    input: vaultDeleteInputSchema,
    output: vaultDeleteOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultDelete(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.search",
    input: vaultSearchInputSchema,
    output: vaultSearchOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceVaultSearch(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.crypto.get",
    input: vaultCryptoGetInputSchema,
    output: vaultCryptoGetOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input, ctx) =>
      service.serviceVaultCryptoGet(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.crypto.init",
    input: vaultCryptoInitInputSchema,
    output: vaultCryptoInitOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultCryptoInit(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.crypto.change",
    input: vaultCryptoChangeInputSchema,
    output: vaultCryptoChangeOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultCryptoChange(
        depsOf(deps).runtime.runtimeDeps(),
        omitUndefined(input),
        ctxAuth(ctx),
      ),
  }),
  defineHubRoute({
    method: "vault.ensureAgent",
    input: vaultEnsureAgentInputSchema,
    output: vaultEnsureAgentOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input, ctx) =>
      service.serviceVaultEnsureAgent(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  }),
] as const;

export const vaultHubRoutes = mergeFeatureRoutes(routes);
