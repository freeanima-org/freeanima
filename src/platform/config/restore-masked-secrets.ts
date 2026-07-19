import { CONFIG_MASKED_SECRET, isConfigSecretKey } from "./config-sanitize.ts";

/**
 * 将 API/UI 回写中的历史占位 `"***"` 还原为已保存密文。
 * （配置 get 已不再脱敏；此逻辑防旧表单/缓存仍带占位符写回。）
 * - 密钥字段值为 `"***"` → 保留 existing
 * - `""` → 显式清空（保留空串）
 * - 其它新值 → 覆盖
 */
export function restoreMaskedSecrets(
  incoming: Record<string, unknown>,
  existing: unknown,
): Record<string, unknown> {
  const existingRecord =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : undefined;
  return restoreRecord(incoming, existingRecord);
}

function restoreRecord(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    const prev = existing?.[key];

    if (isConfigSecretKey(key)) {
      if (typeof value === "string") {
        if (value.trim() === CONFIG_MASKED_SECRET) {
          if (typeof prev === "string") out[key] = prev;
          continue;
        }
        out[key] = value;
        continue;
      }
      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        out[key] = restoreRecord(
          value as Record<string, unknown>,
          prev != null && typeof prev === "object" && !Array.isArray(prev)
            ? (prev as Record<string, unknown>)
            : undefined,
        );
        continue;
      }
      out[key] = value;
      continue;
    }

    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = restoreRecord(
        value as Record<string, unknown>,
        prev != null && typeof prev === "object" && !Array.isArray(prev)
          ? (prev as Record<string, unknown>)
          : undefined,
      );
      continue;
    }

    if (Array.isArray(value)) {
      const prevArr = Array.isArray(prev) ? prev : undefined;
      out[key] = value.map((item, i) => {
        if (item != null && typeof item === "object" && !Array.isArray(item)) {
          const prevItem = prevArr?.[i];
          return restoreRecord(
            item as Record<string, unknown>,
            prevItem != null && typeof prevItem === "object" && !Array.isArray(prevItem)
              ? (prevItem as Record<string, unknown>)
              : undefined,
          );
        }
        return item;
      });
      continue;
    }

    out[key] = value;
  }
  return out;
}
