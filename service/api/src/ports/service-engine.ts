import type { Config } from "@freeanima/engine-config";
import type { LlmRuntime } from "@freeanima/engine-llm";
import type { PgRepositories } from "@freeanima/engine-repos";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import type { Logger } from "@freeanima/kernel-logging";

/** Narrow engine view required by ServiceContext */
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
