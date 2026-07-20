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
 * - MCP `env` / `headers` 与其它配置段一致，明文往返以便设置/栖息地可编辑
 */
function sanitizeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

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

/** Runtime config snapshot for HTTP / Habitat（密钥明文；含 MCP env/headers） */
export function sanitizeConfigForApi(cfg: RuntimeConfig | AnimaConfig): Record<string, unknown> {
  return sanitizeRecord(cfg as Record<string, unknown>);
}
