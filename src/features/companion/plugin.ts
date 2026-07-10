import {
  handleCompanionAssetGet,
  handleCompanionModelUpload,
  handleCompanionMotionImport,
} from "./hub/binary.ts";
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
} from "./hub/rpc.ts";

/** Companion feature plugin — Hub SSOT for config/assets; Settings UI via Hub RPC. */
export const companionPlugin = {
  id: "companion",
  hub: {
    rpc: {
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
    },
  },
} as const;
