export { registerBrowserTools } from "./browser.ts";
export { registerToolsetTools } from "./toolset.ts";
export { registerSkillsTools } from "./skill.ts";
export { registerDocsTools } from "./docs.ts";
export { registerTodoTool } from "./todo.ts";
export { registerFileTools } from "./file.ts";
export { registerConversationTools } from "./conversation.ts";
export { registerTerminalTools, registerShellTools } from "./shell.ts";
export { registerWebTools } from "./web.ts";
export { registerExecuteCodeTool } from "./shell.ts";
export { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";
export { buildExecuteCodeToolDefs } from "./execute-code.ts";
export { buildTerminalToolDefs } from "./terminal.ts";
export { buildEntitySearchToolDefs } from "./entity-search.ts";

import type { Config } from "@freeanima/habitat/core/config";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import type { SkillRegistry } from "@freeanima/habitat/core/skill";
import { bindBrowserToolsConfig } from "./browser-camofox.ts";
import { bindWebToolsConfig } from "./web.ts";
import { registerBrowserTools } from "./browser.ts";
import { registerToolsetTools } from "./toolset.ts";
import { registerFileTools } from "./file.ts";
import { registerConversationTools } from "./conversation.ts";
import { registerSkillsTools } from "./skill.ts";
import { registerDocsTools } from "./docs.ts";
import { registerShellTools } from "./shell.ts";
import { registerWebTools } from "./web.ts";

/** Core tool sets (entity+tag merged at platform composition root) */
export function registerCoreTools(toolSets: ToolSetRegistry, config: Config): void {
  bindWebToolsConfig(config);
  registerToolsetTools(toolSets);
  registerConversationTools(toolSets);
  registerFileTools(toolSets);
  registerShellTools(toolSets);
  registerWebTools(toolSets);
}

/** skills + docs + browser */
export function registerSupplementalTools(
  toolSets: ToolSetRegistry,
  skills: SkillRegistry,
  config: Config,
): void {
  bindBrowserToolsConfig(config);
  registerSkillsTools(toolSets, skills);
  registerDocsTools(toolSets);
  registerBrowserTools(toolSets);
}
