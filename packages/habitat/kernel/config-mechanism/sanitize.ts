/**
 * 历史 UI/API 写回占位；当前 get 不再脱敏，但 patch 仍可能收到旧表单里的 `"***"`。
 */
export const CONFIG_MASKED_SECRET = "***";

/** Sanitize entire value when key name matches (case-insensitive) */
const SECRET_KEY_PATTERN =
  /(?:^|_)(api[_-]?key|token|secret|password|pushkey|push_key|auth|credential|private[_-]?key)(?:$|_)/i;

export function isConfigSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export type MaskConfigSecretsOptions = {
  /** 额外恒掩码路径，如 `database.url`（产品特例，勿写死在默认逻辑） */
  extraMaskPaths?: readonly string[];
  /** 是否掩码名为 env / headers 的对象内字符串值（LLM tool 用） */
  maskEnvAndHeaders?: boolean;
};

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

/** 配置快照供 HTTP / Habitat（默认不脱敏，明文往返） */
export function sanitizeConfigForApi(cfg: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(cfg);
}

function shouldExtraMask(
  parentKey: string | undefined,
  key: string,
  extra: ReadonlySet<string>,
): boolean {
  const leaf = parentKey ? `${parentKey}.${key}` : key;
  return extra.has(leaf);
}

function maskRecordForLlm(
  obj: Record<string, unknown>,
  options: MaskConfigSecretsOptions,
  extra: ReadonlySet<string>,
  parentKey?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const maskEnvAndHeaders = options.maskEnvAndHeaders !== false;

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (isConfigSecretKey(key) || shouldExtraMask(parentKey, key, extra)) {
      out[key] = CONFIG_MASKED_SECRET;
      continue;
    }

    if (
      maskEnvAndHeaders &&
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
      out[key] = maskRecordForLlm(value as Record<string, unknown>, options, extra, key);
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item != null && typeof item === "object" && !Array.isArray(item)
          ? maskRecordForLlm(item as Record<string, unknown>, options, extra, key)
          : item,
      );
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** 配置快照供 LLM tools（密钥与可选 env/headers 掩码） */
export function maskConfigSecretsForLlm(
  cfg: Record<string, unknown>,
  options: MaskConfigSecretsOptions = {},
): Record<string, unknown> {
  const extra = new Set(options.extraMaskPaths ?? []);
  return maskRecordForLlm(cfg, options, extra);
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
        const item: unknown = value[i];
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
