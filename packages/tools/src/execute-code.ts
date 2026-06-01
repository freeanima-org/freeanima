import { registerTool } from "@freeanima/core";
import { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.js";

export function registerExecuteCodeTool(): void {
  registerTool({
    name: "execute_code",
    description:
      "在子进程中执行代码片段（无 shell）。runtime 默认 nodejs：TypeScript/JavaScript，可用 node:fs 等内置模块。" +
      "python/deno 已预留但未启用；Python 脚本请暂用 terminal。复杂 shell 操作用 terminal。",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "TypeScript 或 JavaScript 源码（runtime=nodejs 时）",
        },
        runtime: {
          type: "string",
          enum: ["nodejs", "python", "deno"],
          default: "nodejs",
          description: "执行运行时，默认 nodejs",
        },
        timeout: {
          type: "integer",
          default: 300,
          description: "超时秒数，上限 600",
        },
      },
      required: ["code"],
    },
    handler: (a) => {
      const code = String(a.code ?? "");
      const runtime = parseRuntime(a.runtime);
      const timeout = clampTimeout(a.timeout);
      return runExecuteCode(code, runtime, timeout);
    },
  });
}
