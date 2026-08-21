import { asRecord } from "@freeanima/shared/util";
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
  return restoreRecord(incoming, asRecord(existing) ?? undefined);
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
      const valueRec = asRecord(value);
      if (valueRec) {
        out[key] = restoreRecord(valueRec, asRecord(prev) ?? undefined);
        continue;
      }
      out[key] = value;
      continue;
    }

    const nested = asRecord(value);
    if (nested) {
      out[key] = restoreRecord(nested, asRecord(prev) ?? undefined);
      continue;
    }

    if (Array.isArray(value)) {
      const prevArr = Array.isArray(prev) ? prev : undefined;
      out[key] = value.map((item, i) => {
        const itemRec = asRecord(item);
        if (itemRec) {
          return restoreRecord(itemRec, asRecord(prevArr?.[i]) ?? undefined);
        }
        return item;
      });
      continue;
    }

    out[key] = value;
  }
  return out;
}
