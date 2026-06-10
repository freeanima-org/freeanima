import type { PgRepositories } from "@freeanima/engine-repos";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

/** ServiceContext 所需的 engine 窄视图 */
export type ServiceEnginePort = {
  catalog: {
    toolSets: ToolSetRegistry;
  };
  repos: PgRepositories;
  skills: SkillRegistry;
};
