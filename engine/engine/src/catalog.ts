import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolSetRegistry } from "@freeanima/engine-tool";

/** Engine 层 runtime catalog：toolSets / skills */
export type EngineCatalog = {
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
};

/** 组合根或单测创建独立 catalog 实例 */
export function createEngineCatalog(): EngineCatalog {
  return {
    toolSets: new ToolSetRegistry(),
    skills: new SkillRegistry(),
  };
}
