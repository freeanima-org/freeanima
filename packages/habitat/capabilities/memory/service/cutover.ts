/**
 * #16102 park / cutover — 委托 core config；无 active config 时用缺省（cutover 开）。
 */

import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import {
  resolveMemoryCutoverFlags as resolveFromConfig,
  type MemoryCutoverFlags,
} from "@freeanima/habitat/core/config/schemas/memory-config.ts";

export type { MemoryCutoverFlags };
export { resolveFromConfig as resolveMemoryCutoverFlags };

/** 写入被 park 时的统一错误文案 */
export const MEMORY_PARKED_WRITE_MESSAGE =
  "该记忆类型已 park（#16102）：limbic / dream / narrative 停写，存量只读";

/** 安全读取 active runtime；未 bind 时等同缺省 cutover */
export function resolveActiveMemoryCutoverFlags(): MemoryCutoverFlags {
  try {
    return resolveFromConfig(getActiveRuntimeConfig().data);
  } catch {
    return resolveFromConfig(null);
  }
}
