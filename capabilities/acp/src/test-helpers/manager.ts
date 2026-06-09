import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolRegistry } from "@freeanima/engine-tool";
import { AcpManager } from "../manager.ts";

/** 单测用：绑定独立 catalog 的 AcpManager */
export function createTestAcpManager(): {
  mgr: AcpManager;
  tools: ToolRegistry;
  skills: SkillRegistry;
} {
  const tools = new ToolRegistry();
  const skills = new SkillRegistry();
  const mgr = new AcpManager();
  mgr.wireRegistries({ tools, skills });
  return { mgr, tools, skills };
}
