import { readFileSync, existsSync } from "node:fs";

import { expandConfigEnv } from "@freeanima/habitat/kernel/config-mechanism";
import { PATHS } from "@freeanima/habitat/core/config/paths";

import { asRecord } from "@freeanima/shared/util";

import { parseYaml } from "./yaml.ts";

/** 读取并展开 config.yaml 为 record（不存在或解析失败返回 {}） */
export function loadConfigYamlRecord(): Record<string, unknown> {
  if (!existsSync(PATHS.configYaml)) return {};
  try {
    const raw = expandConfigEnv(readFileSync(PATHS.configYaml, "utf-8"));
    return asRecord(parseYaml(raw)) ?? {};
  } catch {
    return {};
  }
}
