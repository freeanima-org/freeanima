import { readFileSync, existsSync } from "node:fs";

import { expandConfigEnv } from "./env-expand.ts";
import { parseYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";

/** 读取并展开 config.yaml 为 record（不存在或解析失败返回 {}） */
export function loadConfigYamlRecord(): Record<string, unknown> {
  if (!existsSync(PATHS.configYaml)) return {};
  try {
    const raw = expandConfigEnv(readFileSync(PATHS.configYaml, "utf-8"));
    const data = parseYaml(raw);
    return typeof data === "object" && data != null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
