import { SkillRegistry } from "@freeanima/host/core/skill";
import { ToolSetRegistry } from "@freeanima/host/core/tool";

/** Engine-layer runtime catalog: toolSets / skills */
export type EngineCatalog = {
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
};

/** Composition root or unit test creates isolated catalog instance */
export function createEngineCatalog(): EngineCatalog {
  return {
    toolSets: new ToolSetRegistry(),
    skills: new SkillRegistry(),
  };
}
