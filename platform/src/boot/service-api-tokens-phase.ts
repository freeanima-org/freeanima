import type { FileConfig } from "@freeanima/platform/config";
import { resolveWorldSubjectIds } from "@freeanima/core/config/worlds";
import {
  countServiceApiTokens,
  importServiceApiTokenFromPlaintext,
} from "@freeanima/core/db/pg/service-api-token";
import { logComponent } from "@freeanima/platform/logging";

import { startupLog } from "./status.ts";

export type ServiceApiTokensPhaseResult = Record<string, never>;

/** Phase 2.6: 将 legacy remote_auth.token 迁入 service_api_tokens（world-subjects 之后） */
export async function bootServiceApiTokensPhase(
  config: FileConfig,
): Promise<ServiceApiTokensPhaseResult> {
  startupLog("Checking service API tokens…");
  const existing = await countServiceApiTokens();
  if (existing > 0) {
    startupLog(`Service API tokens ready (${existing} active)`);
    return {};
  }

  const legacyToken = config.data.remote_auth?.token?.trim();
  if (legacyToken) {
    const { user_subject_id } = resolveWorldSubjectIds(config.data);
    await importServiceApiTokenFromPlaintext({
      subject_id: user_subject_id,
      name: "migrated from remote_auth",
      plaintext: legacyToken,
      scopes: ["full"],
    });
    logComponent("startup").info(
      "已将 config.yaml 中的 remote_auth.token 迁移为 service API token；请删除 remote_auth 段并在客户端配置新 token",
      { subject_id: user_subject_id },
    );
    startupLog("Migrated remote_auth.token to service API token");
    return {};
  }

  logComponent("startup").warn(
    "尚无 service API token；远程访问前请运行: anima token create --subject-id <id> --name bootstrap",
  );
  startupLog("No service API tokens configured");
  return {};
}
