import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import {
  CONFIG_MASKED_SECRET,
  findForbiddenLlmConfigPatchPath,
  isConfigSecretKey,
  maskConfigSecretsForLlm as maskConfigSecretsForLlmKernel,
  sanitizeConfigForApi as sanitizeConfigForApiKernel,
} from "@freeanima/habitat/kernel/config-mechanism";
import { asRecord } from "@freeanima/shared/util";

export { CONFIG_MASKED_SECRET, isConfigSecretKey, findForbiddenLlmConfigPatchPath };

/** Runtime config snapshot for HTTP / Habitat（密钥明文；含 MCP env/headers） */
export function sanitizeConfigForApi(cfg: RuntimeConfig): Record<string, unknown> {
  const out = sanitizeConfigForApiKernel(cfg);
  // identity 私钥 / subject_keys 永不经 Habitat 配置 API 下发
  const id = asRecord(out.identity);
  if (id) {
    out.identity = {
      ...(typeof id.habitat_instance_id === "string"
        ? { habitat_instance_id: id.habitat_instance_id }
        : {}),
      ...(typeof id.public_key === "string" ? { public_key: id.public_key } : {}),
    };
  }
  return out;
}

/** Runtime config snapshot for LLM tools（密钥与 MCP env/headers 掩码） */
export function maskConfigSecretsForLlm(
  cfg: RuntimeConfig | Record<string, unknown>,
): Record<string, unknown> {
  return maskConfigSecretsForLlmKernel(cfg, {
    extraMaskPaths: ["database.url"],
    maskEnvAndHeaders: true,
  });
}
