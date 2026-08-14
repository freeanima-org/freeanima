import type { Config } from "@freeanima/habitat/core/config";
import type { LlmRuntime } from "@freeanima/habitat/core/llm";
import type { SkillRegistry } from "@freeanima/habitat/core/skill";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import type { Logger } from "@freeanima/habitat/kernel/logging";

/** Narrow engine view required by AppRuntime */
export type ServiceEnginePort = {
  catalog: {
    toolSets: ToolSetRegistry;
  };
  llm: LlmRuntime;
  skills: SkillRegistry;
  config: Config;
  logger: Logger;
};
