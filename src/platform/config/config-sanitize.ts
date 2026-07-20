import type { AnimaConfig } from "@freeanima/core/config";
import type { RuntimeConfig } from "@freeanima/core/config";

/**
 * 历史 UI/API 写回占位；当前 get 不再脱敏，但 patch 仍可能收到旧表单里的 `"***"`。
 * 写库前由 restoreMaskedSecrets 还原。
 */
export const CONFIG_MASKED_SECRET = "***";

/** Sanitize entire value when key name matches (case-insensitive) */
const SECRET_KEY_PATTERN =
  /(?:^|_)(api[_-]?key|token|secret|password|pushkey|push_key|auth|credential)(?:$|_)/i;

export function isConfigSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * 递归整理配置快照供 HTTP / Habitat：
 * - 密钥字段（api_key 等）与 database.url **原样返回**（不脱敏）
 * - MCP `env` 仍只暴露 `env_keys`（不把环境变量明文塞进配置段）
 */
function sanitizeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (key === "env" && value != null && typeof value === "object" && !Array.isArray(value)) {
      const envKeys = Object.keys(value as Record<string, unknown>);
      if (envKeys.length > 0) out.env_keys = envKeys;
      continue;
    }

    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeRecord(value as Record<string, unknown>);
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item != null && typeof item === "object" && !Array.isArray(item)
          ? sanitizeRecord(item as Record<string, unknown>)
          : item,
      );
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** Runtime config snapshot for HTTP / Habitat（密钥明文；MCP env → env_keys） */
export function sanitizeConfigForApi(cfg: RuntimeConfig | AnimaConfig): Record<string, unknown> {
  return sanitizeRecord(cfg as Record<string, unknown>);
}
