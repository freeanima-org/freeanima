import { COMPANION_APP_ID } from "../shared/constants.ts";
import { getSapInstanceId, isSapConnected } from "./sap/hub.ts";
import { activeModelPath, loadConfig, type CompanionConfig } from "./config.ts";
import { isModelPathAvailable } from "./model-path.ts";
import { listModels, scanModelsOnDisk } from "./model-registry.ts";
import { listMotionLibrary, syncLibraryFromDisk } from "./motion-library.ts";
import { fbxImportAvailable } from "./fbx-converter-kit.ts";

export type ClientCompanionConfig = CompanionConfig & {
  app_id: typeof COMPANION_APP_ID;
  instance_id: string;
  model_path: string;
  model_available: boolean;
  sap_connected: boolean;
  fbx_import_available: boolean;
};

export function clientCompanionConfig(cfg: CompanionConfig = loadConfig()): ClientCompanionConfig {
  scanModelsOnDisk();
  syncLibraryFromDisk();
  const model_path = activeModelPath(cfg);
  return {
    app_id: COMPANION_APP_ID,
    instance_id: getSapInstanceId(),
    ...cfg,
    models: listModels(),
    motion_library: listMotionLibrary(),
    model_path,
    model_available: isModelPathAvailable(model_path),
    sap_connected: isSapConnected(),
    fbx_import_available: fbxImportAvailable(),
  };
}
