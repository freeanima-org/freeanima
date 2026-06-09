import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { AcpManager } from "../manager.ts";

/** 单测用：绑定独立 catalog 的 AcpManager */
export function createTestAcpManager(): {
  mgr: AcpManager;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
} {
  const toolSets = new ToolSetRegistry();
  const skills = new SkillRegistry();
  const mgr = new AcpManager();
  mgr.wireRegistries({ toolSets, skills });
  return { mgr, toolSets, skills };
}
