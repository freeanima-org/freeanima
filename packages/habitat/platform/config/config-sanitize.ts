import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import {
  CONFIG_MASKED_SECRET,
  findForbiddenLlmConfigPatchPath,
  isConfigSecretKey,
  maskConfigSecretsForLlm as maskConfigSecretsForLlmKernel,
  sanitizeConfigForApi as sanitizeConfigForApiKernel,
} from "@freeanima/habitat/kernel/config-mechanism";

export { CONFIG_MASKED_SECRET, isConfigSecretKey, findForbiddenLlmConfigPatchPath };

/** Runtime config snapshot for HTTP / Habitat（密钥明文；含 MCP env/headers） */
export function sanitizeConfigForApi(cfg: RuntimeConfig): Record<string, unknown> {
  return sanitizeConfigForApiKernel(cfg);
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
