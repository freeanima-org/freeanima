import type { Config } from "@freeanima/host/core/config";
import type { LlmRuntime } from "@freeanima/host/core/llm";
import type { SkillRegistry } from "@freeanima/host/core/skill";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import type { Logger } from "@freeanima/host/kernel/logging";

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
