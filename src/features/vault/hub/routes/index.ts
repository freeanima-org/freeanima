import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { vaultMethodDefs } from "@freeanima/shared/hub-contract/registry/vault.ts";

import {
  handleVaultCreate,
  handleVaultCreatePlain,
  handleVaultCryptoChange,
  handleVaultCryptoGet,
  handleVaultCryptoInit,
  handleVaultDelete,
  handleVaultEnsureAgent,
  handleVaultGet,
  handleVaultList,
  handleVaultPatch,
  handleVaultPatchPlain,
  handleVaultSearch,
} from "../rpc.ts";

export const vaultHubRoutes = attachHandlersToDefs(vaultMethodDefs, {
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
} as Record<keyof typeof vaultMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
