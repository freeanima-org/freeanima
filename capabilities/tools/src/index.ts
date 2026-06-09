export { registerBrowserTools } from "./browser.ts";
export { registerCatalogTools } from "./catalog-tools.ts";
export { registerSkillsTools } from "./skills-tools.ts";
export { registerTodoTool } from "./todo-tool.ts";
export { registerFileTools } from "./file.ts";
export { registerSessionTools } from "./sessions-tools.ts";
export { registerTerminalTools } from "./terminal.ts";
export { registerWebTools } from "./web.ts";
export { registerCredentialTools } from "./credential-tool.ts";
export { registerExecuteCodeTool } from "./execute-code.ts";
export { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";

import type { ToolSetRegistry } from "@freeanima/engine-tool";
import type { SkillRegistry } from "@freeanima/engine-skill";
import { registerBrowserTools } from "./browser.ts";
import { registerCatalogTools } from "./catalog-tools.ts";
import { registerCredentialTools } from "./credential-tool.ts";
import { registerExecuteCodeTool } from "./execute-code.ts";
import { registerFileTools } from "./file.ts";
import { registerSessionTools } from "./sessions-tools.ts";
import { registerSkillsTools } from "./skills-tools.ts";
import { registerTerminalTools } from "./terminal.ts";
import { registerWebTools } from "./web.ts";

/** 基础工具集 */
export function registerCoreTools(toolSets: ToolSetRegistry): void {
  registerCatalogTools(toolSets);
  registerSessionTools(toolSets);
  registerFileTools(toolSets);
  registerCredentialTools(toolSets);
  registerExecuteCodeTool(toolSets);
  registerTerminalTools(toolSets);
  registerWebTools(toolSets);
}

/** skills + browser */
export function registerSupplementalTools(toolSets: ToolSetRegistry, skills: SkillRegistry): void {
  registerSkillsTools(toolSets, skills);
  registerBrowserTools(toolSets);
}
