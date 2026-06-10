import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { attachToolReturns } from "@freeanima/engine-tool";

import { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

export function registerExecuteCodeTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "code",
    "子进程代码执行",
    attachToolReturns(
      [
        {
          name: "code_execute",
          description:
            "在子进程中执行代码片段（无 shell）。runtime 默认 bun：TypeScript/JavaScript，可用 node:fs 等内置模块。" +
            "可选 runtime=nodejs。Python 脚本请用 terminal。复杂 shell 操作用 terminal。",
          parameters: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "TypeScript 或 JavaScript 源码（runtime=bun 或 nodejs 时）",
              },
              runtime: {
                type: "string",
                enum: ["bun", "nodejs"],
                default: "bun",
                description: "执行运行时，默认 bun",
              },
              timeout: {
                type: "integer",
                default: 300,
                description: "超时秒数，上限 600",
              },
            },
            required: ["code"],
          },
          handler: async (a) => {
            const code = String(a.code ?? "");
            const runtime = parseRuntime(a.runtime);
            const timeout = clampTimeout(a.timeout);
            return runExecuteCode(code, runtime, timeout);
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
