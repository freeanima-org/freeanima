import { omitUndefined } from "@freeanima/core/util";
import {
  vaultListInputSchema,
  vaultGetInputSchema,
  vaultCreateInputSchema,
  vaultCreatePlainInputSchema,
  vaultPatchInputSchema,
  vaultPatchPlainInputSchema,
  vaultDeleteInputSchema,
  vaultSearchInputSchema,
  vaultCryptoGetInputSchema,
  vaultCryptoInitInputSchema,
  vaultCryptoChangeInputSchema,
  vaultEnsureAgentInputSchema,
  type SapRequestAuthContext,
  type SapRequestContext,
} from "@freeanima/sap-contract";
import type { SapServerDeps } from "../types.ts";
import * as serviceEntityVault from "../../runtime/service-entity-vault.ts";

export async function handleVaultList(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultListInputSchema.parse(payload ?? {});
  return serviceEntityVault.serviceVaultList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultGet(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultGetInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultGet(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultCreate(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultCreateInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultCreate(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultCreatePlain(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultCreatePlainInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultCreatePlain(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultPatch(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultPatchInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultPatch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultPatchPlain(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultPatchPlainInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultPatchPlain(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultDelete(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultDeleteInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultDelete(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultSearch(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultSearchInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultSearch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultCryptoGet(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultCryptoGetInputSchema.parse(payload ?? {});
  return serviceEntityVault.serviceVaultCryptoGet(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultCryptoInit(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultCryptoInitInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultCryptoInit(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultCryptoChange(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultCryptoChangeInputSchema.parse(payload);
  return serviceEntityVault.serviceVaultCryptoChange(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
    ctx.auth,
  );
}

export async function handleVaultEnsureAgent(
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) {
  const input = vaultEnsureAgentInputSchema.parse(payload ?? {});
  return serviceEntityVault.serviceVaultEnsureAgent(deps.runtime.runtimeDeps(), input, ctx.auth);
}

export type { SapRequestAuthContext };
