import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import type { SapServerDeps } from "@freeanima/platform/sap/types";
import {
  companionConfigGetInputSchema,
  companionConfigUpdateInputSchema,
  companionMigrateFromLocalInputSchema,
  companionModelDeleteInputSchema,
  companionModelRenameInputSchema,
  companionModelSetActiveInputSchema,
  companionMotionDeleteInputSchema,
  companionMotionRenameInputSchema,
  companionMotionSetSlotInputSchema,
  companionSyncPullInputSchema,
} from "../protocol/index.ts";
import {
  serviceCompanionConfigGet,
  serviceCompanionConfigUpdate,
  serviceCompanionConfigUpdateOmit,
  serviceCompanionMigrateFromLocal,
  serviceCompanionModelDelete,
  serviceCompanionModelRename,
  serviceCompanionModelSetActive,
  serviceCompanionMotionDelete,
  serviceCompanionMotionRename,
  serviceCompanionMotionSetSlot,
  serviceCompanionSyncPull,
} from "./service.ts";

export async function handleCompanionConfigGet(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  companionConfigGetInputSchema.parse(payload);
  return serviceCompanionConfigGet();
}

export async function handleCompanionConfigUpdate(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionConfigUpdateInputSchema.parse(payload);
  return serviceCompanionConfigUpdate(serviceCompanionConfigUpdateOmit(input));
}

export async function handleCompanionModelSetActive(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionModelSetActiveInputSchema.parse(payload);
  return serviceCompanionModelSetActive(input);
}

export async function handleCompanionModelRename(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionModelRenameInputSchema.parse(payload);
  return serviceCompanionModelRename(input);
}

export async function handleCompanionModelDelete(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionModelDeleteInputSchema.parse(payload);
  return serviceCompanionModelDelete(input);
}

export async function handleCompanionMotionSetSlot(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionMotionSetSlotInputSchema.parse(payload);
  return serviceCompanionMotionSetSlot(input);
}

export async function handleCompanionMotionRename(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionMotionRenameInputSchema.parse(payload);
  return serviceCompanionMotionRename(input);
}

export async function handleCompanionMotionDelete(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionMotionDeleteInputSchema.parse(payload);
  return serviceCompanionMotionDelete(input);
}

export async function handleCompanionMigrateFromLocal(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = companionMigrateFromLocalInputSchema.parse(payload);
  return serviceCompanionMigrateFromLocal(input);
}

export async function handleCompanionSyncPull(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  companionSyncPullInputSchema.parse(payload);
  return serviceCompanionSyncPull();
}
