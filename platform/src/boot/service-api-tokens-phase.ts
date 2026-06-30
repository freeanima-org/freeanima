import type { FileConfig } from "@freeanima/platform/config";
import { countServiceApiTokens } from "@freeanima/core/db/pg/service-api-token";
import { logComponent } from "@freeanima/platform/logging";

import { startupLog } from "./status.ts";

export type ServiceApiTokensPhaseResult = Record<string, never>;

/** Phase 2.6: 确认 service API token 已配置（world-subjects 之后） */
export async function bootServiceApiTokensPhase(
  _config: FileConfig,
): Promise<ServiceApiTokensPhaseResult> {
  startupLog("Checking service API tokens…");
  const existing = await countServiceApiTokens();
  if (existing > 0) {
    startupLog(`Service API tokens ready (${existing} active)`);
    return {};
  }

  logComponent("startup").warn(
    "尚无 service API token；远程访问前请运行: anima token create --subject-id <id> --name bootstrap",
  );
  startupLog("No service API tokens configured");
  return {};
}
