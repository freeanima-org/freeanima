import { COMPANION_APP_ID } from "../shared/constants.ts";
import { getSapInstanceId } from "./sap/hub.ts";
import { isModelPathAvailable } from "./model-path.ts";
import { loadConfig, type CompanionConfig } from "./config.ts";

export type ClientCompanionConfig = CompanionConfig & {
  app_id: typeof COMPANION_APP_ID;
  instance_id: string;
  model_available: boolean;
};

export function clientCompanionConfig(cfg: CompanionConfig = loadConfig()): ClientCompanionConfig {
  return {
    app_id: COMPANION_APP_ID,
    instance_id: getSapInstanceId(),
    ...cfg,
    model_available: isModelPathAvailable(cfg.model_path),
  };
}
