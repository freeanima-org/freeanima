import type { Config } from "@freeanima/storage-config";
import type { LlmRuntime } from "@freeanima/mechanism-llm";
import type { PgRepositories } from "@freeanima/storage-repos";
import type { SkillRegistry } from "@freeanima/mechanism-skill";
import type { ToolSetRegistry } from "@freeanima/mechanism-tool";
import type { Logger } from "@freeanima/kernel/logging";

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
