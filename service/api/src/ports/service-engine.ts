import type { PgRepositories } from "@freeanima/engine-repos";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

/** Narrow engine view required by ServiceContext */
export type ServiceEnginePort = {
  catalog: {
    toolSets: ToolSetRegistry;
  };
  repos: PgRepositories;
  skills: SkillRegistry;
};
