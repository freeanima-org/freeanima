import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { attachToolReturns } from "@freeanima/engine-tool";

import { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

export function registerExecuteCodeTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "code",
    "Subprocess code execution",
    attachToolReturns(
      [
        {
          name: "code_execute",
          description:
            "Execute code snippet in subprocess (no shell). Default runtime bun: TypeScript/JavaScript, can use node:fs etc. " +
            "Optional runtime=nodejs. Use terminal for Python scripts. Use terminal for complex shell operations.",
          parameters: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "TypeScript or JavaScript source (when runtime=bun or nodejs)",
              },
              runtime: {
                type: "string",
                enum: ["bun", "nodejs"],
                default: "bun",
                description: "Execution runtime, default bun",
              },
              timeout: {
                type: "integer",
                default: 300,
                description: "Timeout seconds, max 600",
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
