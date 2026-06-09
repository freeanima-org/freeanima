import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolRegistry, ToolSetRegistry } from "@freeanima/engine-tool";

/** Engine 层 runtime catalog：tools / toolSets / skills */
export type EngineCatalog = {
  tools: ToolRegistry;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
};

/** 组合根或单测创建独立 catalog 实例 */
export function createEngineCatalog(): EngineCatalog {
  return {
    tools: new ToolRegistry(),
    toolSets: new ToolSetRegistry(),
    skills: new SkillRegistry(),
  };
}
