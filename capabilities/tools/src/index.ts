export { registerFileTools } from "./file.ts";
export { registerTerminalTools } from "./terminal.ts";
export { registerWebTools } from "./web.ts";
export { registerCredentialTools } from "./credential-tool.ts";
export { registerExecuteCodeTool } from "./execute-code.ts";
export { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";

import { registerCredentialTools } from "./credential-tool.ts";
import { registerExecuteCodeTool } from "./execute-code.ts";
import { registerFileTools } from "./file.ts";
import { registerTerminalTools } from "./terminal.ts";
import { registerWebTools } from "./web.ts";

/** 无 legacy-runtime 依赖的基础工具集 */
export function registerCoreTools(): void {
  registerFileTools();
  registerCredentialTools();
  registerExecuteCodeTool();
  registerTerminalTools();
  registerWebTools();
}
