export { registerBrowserTools } from "./browser.ts";
export { registerToolsetTools } from "./toolset.ts";
export { registerSkillsTools } from "./skill.ts";
export { registerTodoTool } from "./todo.ts";
export { registerFileTools } from "./file.ts";
export { registerConversationTools } from "./conversation.ts";
export { registerTerminalTools } from "./terminal.ts";
export { registerWebTools } from "./web.ts";
export { registerExecuteCodeTool } from "./execute-code.ts";
export { registerEntitySearchTools } from "./entity-search.ts";
export { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";

import type { Config } from "@freeanima/core/config";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import type { SkillRegistry } from "@freeanima/core/skill";
import { bindBrowserToolsConfig } from "./browser-camofox.ts";
import { bindWebToolsConfig } from "./web.ts";
import { registerBrowserTools } from "./browser.ts";
import { registerToolsetTools } from "./toolset.ts";
import { registerExecuteCodeTool } from "./execute-code.ts";
import { registerFileTools } from "./file.ts";
import { registerConversationTools } from "./conversation.ts";
import { registerSkillsTools } from "./skill.ts";
import { registerTerminalTools } from "./terminal.ts";
import { registerWebTools } from "./web.ts";
import { registerEntitySearchTools } from "./entity-search.ts";

/** Core tool sets */
export function registerCoreTools(toolSets: ToolSetRegistry, config: Config): void {
  bindWebToolsConfig(config);
  registerToolsetTools(toolSets);
  registerConversationTools(toolSets);
  registerFileTools(toolSets);
  registerExecuteCodeTool(toolSets);
  registerTerminalTools(toolSets);
  registerWebTools(toolSets);
  registerEntitySearchTools(toolSets);
}

/** skills + browser */
export function registerSupplementalTools(
  toolSets: ToolSetRegistry,
  skills: SkillRegistry,
  config: Config,
): void {
  bindBrowserToolsConfig(config);
  registerSkillsTools(toolSets, skills);
  registerBrowserTools(toolSets);
}
