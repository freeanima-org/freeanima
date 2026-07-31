import type { CompanionClientConfigPayload } from "@freeanima/shared/rpc-contract/frames/companion";
import {
  companionModelCacheFileName,
  companionMotionCacheFileName,
  sortCompanionEntries,
} from "@freeanima/host/core/config/schemas/companion.ts";
import { getObjectFile } from "@freeanima/features/object-storage/domain";
import { activeModelPath, habitatUrlFromEnv, loadCompanionConfig } from "./config.ts";

export async function buildClientCompanionConfig(): Promise<CompanionClientConfigPayload> {
  const cfg = await loadCompanionConfig();
  const models = sortCompanionEntries(cfg.models);
  const motion_library = sortCompanionEntries(cfg.motion_library);
  const model_path = activeModelPath(cfg);
  const activeId = cfg.active_object_file_id;
  const model_available = activeId != null ? (await getObjectFile(activeId)) != null : false;
  return {
    ...cfg,
    models,
    motion_library,
    habitat_url: habitatUrlFromEnv(),
    model_path,
    model_available,
  };
}

export type CompanionSyncAsset = {
  kind: "models" | "motions";
  file_name: string;
  object_file_id: number;
};

/** sync.pull：按 object_file_id 拉字节；file_name 仅本机缓存名 */
export function listSyncAssets(
  cfg: Awaited<ReturnType<typeof loadCompanionConfig>>,
): CompanionSyncAsset[] {
  const assets: CompanionSyncAsset[] = [];
  for (const model of cfg.models) {
    assets.push({
      kind: "models",
      file_name: companionModelCacheFileName(model.object_file_id),
      object_file_id: model.object_file_id,
    });
  }
  for (const motion of cfg.motion_library) {
    assets.push({
      kind: "motions",
      file_name: companionMotionCacheFileName(motion.object_file_id),
      object_file_id: motion.object_file_id,
    });
  }
  return assets;
}
