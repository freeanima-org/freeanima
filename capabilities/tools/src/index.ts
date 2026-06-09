export { registerBrowserTools } from "./browser.ts";
export { registerSkillsTools } from "./skills-tools.ts";
export { registerTodoTool } from "./todo-tool.ts";
export { registerFileTools } from "./file.ts";
export { registerTerminalTools } from "./terminal.ts";
export { registerWebTools } from "./web.ts";
export { registerCredentialTools } from "./credential-tool.ts";
export { registerExecuteCodeTool } from "./execute-code.ts";
export { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";

import type { ToolRegistry } from "@freeanima/engine-tool";
import type { SkillRegistry } from "@freeanima/engine-skill";
import { registerBrowserTools } from "./browser.ts";
import { registerCredentialTools } from "./credential-tool.ts";
import { registerExecuteCodeTool } from "./execute-code.ts";
import { registerFileTools } from "./file.ts";
import { registerSkillsTools } from "./skills-tools.ts";
import { registerTodoTool } from "./todo-tool.ts";
import { registerTerminalTools } from "./terminal.ts";
import { registerWebTools } from "./web.ts";

/** 基础工具集 */
export function registerCoreTools(tools: ToolRegistry): void {
  registerFileTools(tools);
  registerCredentialTools(tools);
  registerExecuteCodeTool(tools);
  registerTerminalTools(tools);
  registerWebTools(tools);
}

/** skills + browser + todo */
export function registerSupplementalTools(tools: ToolRegistry, skills: SkillRegistry): void {
  registerSkillsTools(tools, skills);
  registerBrowserTools(tools);
  registerTodoTool(tools);
}
