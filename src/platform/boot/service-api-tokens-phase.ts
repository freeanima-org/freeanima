import type { HybridConfig } from "@freeanima/platform/config";
import {
  readLoopbackWebAuthTokenFromEnvOrFile,
  writeLoopbackWebAuthTokenFile,
} from "@freeanima/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/core/config/world-context";
import {
  countServiceApiTokens,
  createServiceApiTokenWithSecret,
} from "@freeanima/core/db/pg/service-api-token";
import { logComponent } from "@freeanima/platform/logging";

import { startupLog } from "./status.ts";

export type ServiceApiTokensPhaseResult = Record<string, never>;

/** Phase 2.6: 确认 service API token 已配置（world-subjects 之后） */
export async function bootServiceApiTokensPhase(
  config: HybridConfig,
): Promise<ServiceApiTokensPhaseResult> {
  startupLog("Checking service API tokens…");
  const existing = await countServiceApiTokens();
  const loopbackToken = readLoopbackWebAuthTokenFromEnvOrFile();

  if (existing > 0) {
    if (loopbackToken) {
      startupLog(`Service API tokens ready (${existing} active, loopback web auth configured)`);
    } else {
      logComponent("startup").warn(
        "Hub 托管 Web UI 需 loopback token：anima token pin-loopback <token> 或设置 FREEANIMA_REMOTE_AUTH_TOKEN",
      );
      startupLog(`Service API tokens ready (${existing} active)`);
    }
    return {};
  }

  const ctx = await resolveAndBindWorldContext(config.data);
  const result = await createServiceApiTokenWithSecret({
    subject_id: ctx.user_subject_id,
    name: "loopback-web-bootstrap",
  });
  writeLoopbackWebAuthTokenFile(result.plaintext);
  startupLog("Created loopback web bootstrap token");
  logComponent("startup").info(
    "已自动创建 Hub 托管 Web UI 的 loopback token（~/.anima/web/loopback-auth.token）",
  );
  return {};
}
