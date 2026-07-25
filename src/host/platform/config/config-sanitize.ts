import type { RuntimeConfig } from "@freeanima/host/core/config";

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
export function sanitizeConfigForApi(cfg: RuntimeConfig): Record<string, unknown> {
  return sanitizeRecord(cfg as Record<string, unknown>);
}

/**
 * 递归掩码配置快照供 LLM Tool 结果：
 * - `isConfigSecretKey` 字段 → `***`
 * - `database.url` → `***`
 * - MCP / 同类 `env` / `headers` 对象内字符串值 → `***`
 */
function maskRecordForLlm(
  obj: Record<string, unknown>,
  parentKey?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (isConfigSecretKey(key) || (parentKey === "database" && key === "url")) {
      out[key] = CONFIG_MASKED_SECRET;
      continue;
    }

    if (
      (key === "env" || key === "headers") &&
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const masked: Record<string, unknown> = {};
      for (const [innerKey, innerVal] of Object.entries(value as Record<string, unknown>)) {
        masked[innerKey] = typeof innerVal === "string" ? CONFIG_MASKED_SECRET : innerVal;
      }
      out[key] = masked;
      continue;
    }

    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = maskRecordForLlm(value as Record<string, unknown>, key);
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item != null && typeof item === "object" && !Array.isArray(item)
          ? maskRecordForLlm(item as Record<string, unknown>, key)
          : item,
      );
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** Runtime config snapshot for LLM tools（密钥与 MCP env/headers 掩码） */
export function maskConfigSecretsForLlm(
  cfg: RuntimeConfig | Record<string, unknown>,
): Record<string, unknown> {
  return maskRecordForLlm(cfg as Record<string, unknown>);
}

/**
 * 检查 patch 树是否含禁止经 LLM 写入的密钥字段或 MCP env/headers。
 * 返回首个违规路径（如 `providers.main.api_key`），无则 null。
 */
export function findForbiddenLlmConfigPatchPath(
  patch: Record<string, unknown>,
  pathPrefix = "",
): string | null {
  for (const [key, value] of Object.entries(patch)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (isConfigSecretKey(key)) return path;
    if (key === "env" || key === "headers") return path;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      const nested = findForbiddenLlmConfigPatchPath(value as Record<string, unknown>, path);
      if (nested) return nested;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item != null && typeof item === "object" && !Array.isArray(item)) {
          const nested = findForbiddenLlmConfigPatchPath(
            item as Record<string, unknown>,
            `${path}[${i}]`,
          );
          if (nested) return nested;
        }
      }
    }
  }
  return null;
}
