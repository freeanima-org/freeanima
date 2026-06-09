import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearConfigCache } from "@freeanima/service-config";

import { MINIMAL_LLM_YAML } from "./minimal-llm-config.ts";

/** 单测/集成测：隔离 FREEANIMA_HOME 并写入满足 animaConfigSchema 的最小 config.yaml */
export function beginMinimalConfigHome(prefix: string): {
  home: string;
  prevHome: string | undefined;
} {
  const prevHome = process.env.FREEANIMA_HOME;
  const home = mkdtempSync(join(tmpdir(), prefix));
  process.env.FREEANIMA_HOME = home;
  writeFileSync(join(home, "config.yaml"), `${MINIMAL_LLM_YAML.trim()}\n`, "utf-8");
  clearConfigCache();
  return { home, prevHome };
}

export function endMinimalConfigHome(prevHome: string | undefined): void {
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  clearConfigCache();
}
