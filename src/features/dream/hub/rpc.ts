import { omitUndefined } from "@freeanima/core/util";
import {
  dreamListInputSchema,
  dreamGetInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as serviceEntityDream from "./service.ts";

/** Minimal SAP server deps for dream handlers (structural superset: platform SapServerDeps). */
export type DreamSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handleDreamList(
  deps: DreamSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = dreamListInputSchema.parse(payload ?? {});
  return serviceEntityDream.serviceDreamList(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handleDreamGet(
  deps: DreamSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = dreamGetInputSchema.parse(payload);
  return serviceEntityDream.serviceDreamGet(deps.runtime.runtimeDeps(), input);
}
