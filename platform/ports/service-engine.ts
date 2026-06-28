import type { Config } from "@freeanima/core/config";
import type { LlmRuntime } from "@freeanima/core/llm";
import type { PgRepositories } from "@freeanima/core/repos";
import type { SkillRegistry } from "@freeanima/core/skill";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import type { Logger } from "@freeanima/kernel/logging";

/** Narrow engine view required by AppRuntime */
export type ServiceEnginePort = {
  catalog: {
    toolSets: ToolSetRegistry;
  };
  llm: LlmRuntime;
  repos: PgRepositories;
  skills: SkillRegistry;
  config: Config;
  logger: Logger;
};
