import { existsSync, readFileSync } from "node:fs";

import { PATHS } from "@freeanima/service-config";

/** 读取 SOUL.md 自我锚点文本 */
export function loadSoul(): string {
  try {
    if (!existsSync(PATHS.soul)) return "";
    return readFileSync(PATHS.soul, "utf-8").trim();
  } catch {
    return "";
  }
}
