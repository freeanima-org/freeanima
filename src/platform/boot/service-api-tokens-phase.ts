import type { RuntimeConfigStore } from "@freeanima/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/core/config/world-context";
import {
  countServiceApiTokens,
  createServiceApiTokenWithSecret,
} from "@freeanima/core/db/pg/service-api-token";
import { logComponent } from "@freeanima/platform/logging";

import { ensureDevWebTokenFile } from "./dev-web-token.ts";
import { startupLog } from "./status.ts";

export type ServiceApiTokensPhaseResult = Record<string, never>;

/** Phase 2.6: 确认 service API token 已配置（world-subjects 之后） */
export async function bootServiceApiTokensPhase(
  config: RuntimeConfigStore,
): Promise<ServiceApiTokensPhaseResult> {
  startupLog("Checking service API tokens…");
  const existing = await countServiceApiTokens();

  if (existing > 0) {
    startupLog(`Service API tokens ready (${existing} active)`);
  } else {
    const ctx = await resolveAndBindWorldContext(config.data);
    const result = await createServiceApiTokenWithSecret({
      subject_id: ctx.user_subject_id,
      name: "bootstrap",
    });
    startupLog(`Created service API bootstrap token (id=${result.token.id})`);
    logComponent("startup").info(
      "已自动创建 bootstrap Service API Token；请在客户端连接设置中配置（明文仅此次输出到终端）",
    );
    console.log(result.plaintext);
  }

  await ensureDevWebTokenFile(config);
  return {};
}
