import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { companionMethodDefs } from "@freeanima/shared/hub-contract/registry/features.ts";

import {
  handleCompanionAssetGet,
  handleCompanionModelUpload,
  handleCompanionMotionImport,
} from "../binary.ts";
import {
  handleCompanionConfigGet,
  handleCompanionConfigUpdate,
  handleCompanionMigrateFromLocal,
  handleCompanionModelDelete,
  handleCompanionModelRename,
  handleCompanionModelSetActive,
  handleCompanionMotionDelete,
  handleCompanionMotionRename,
  handleCompanionMotionSetSlot,
  handleCompanionSyncPull,
} from "../rpc.ts";

export const companionHubRoutes = attachHandlersToDefs(companionMethodDefs, {
  "companion.config.get": handleCompanionConfigGet,
  "companion.config.update": handleCompanionConfigUpdate,
  "companion.model.setActive": handleCompanionModelSetActive,
  "companion.model.rename": handleCompanionModelRename,
  "companion.model.delete": handleCompanionModelDelete,
  "companion.motion.setSlot": handleCompanionMotionSetSlot,
  "companion.motion.rename": handleCompanionMotionRename,
  "companion.motion.delete": handleCompanionMotionDelete,
  "companion.migrate.fromLocal": handleCompanionMigrateFromLocal,
  "companion.sync.pull": handleCompanionSyncPull,
  "companion.asset.get": handleCompanionAssetGet,
  "companion.model.upload": handleCompanionModelUpload,
  "companion.motion.import": handleCompanionMotionImport,
} as Record<keyof typeof companionMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
