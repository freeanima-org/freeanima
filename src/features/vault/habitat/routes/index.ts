import { omitUndefined } from "@freeanima/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { vaultMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type VaultRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): VaultRemoteToolsServerDeps {
  return deps as VaultRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const vaultHubRoutes = bindHabitatRouteHandlers(vaultMethodDefs, {
  "vault.list": async (deps, input, ctx) =>
    service.serviceVaultList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.get": async (deps, input, ctx) =>
    service.serviceVaultGet(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input), ctxAuth(ctx)),
  "vault.create": async (deps, input, ctx) =>
    service.serviceVaultCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.createPlain": async (deps, input, ctx) =>
    service.serviceVaultCreatePlain(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.patch": async (deps, input, ctx) =>
    service.serviceVaultPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.patchPlain": async (deps, input, ctx) =>
    service.serviceVaultPatchPlain(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.delete": async (deps, input, ctx) =>
    service.serviceVaultDelete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.search": async (deps, input, ctx) =>
    service.serviceVaultSearch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.crypto.get": async (deps, input, ctx) =>
    service.serviceVaultCryptoGet(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.crypto.init": async (deps, input, ctx) =>
    service.serviceVaultCryptoInit(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.crypto.change": async (deps, input, ctx) =>
    service.serviceVaultCryptoChange(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "vault.ensureAgent": async (deps, input, ctx) =>
    service.serviceVaultEnsureAgent(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
});
