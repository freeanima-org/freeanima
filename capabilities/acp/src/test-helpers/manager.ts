import { Config } from "@freeanima/storage-config";
import { SkillRegistry } from "@freeanima/mechanism-skill";
import { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { AcpManager } from "../manager.ts";

/** For unit tests: AcpManager with isolated catalog */
export function createTestAcpManager(config: Config): {
  mgr: AcpManager;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
} {
  const toolSets = new ToolSetRegistry();
  const skills = new SkillRegistry();
  const mgr = new AcpManager();
  mgr.wireRegistries({ toolSets, skills, config });
  return { mgr, toolSets, skills };
}
