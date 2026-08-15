import { attachToolReturns } from "@freeanima/habitat/core/tool";

import { clampTimeout, parseRuntime, runExecuteCode } from "./execute-code-runtimes.ts";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  parseSecretsArg,
  resolveSubprocessSecrets,
  SECRETS_TOOL_PROPERTY,
} from "./subprocess-secrets.ts";

export function buildExecuteCodeToolDefs() {
  return attachToolReturns(
    [
      {
        name: "code_execute",
        description:
          "Execute code snippet in subprocess (no shell). Default runtime bun: TypeScript/JavaScript, can use node:fs etc. " +
          "Optional runtime=nodejs. Optional secrets[] injects vault fields into this subprocess env only (not Habitat process.env). " +
          "Use terminal for Python scripts. Use terminal for complex shell operations.",
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
            secrets: SECRETS_TOOL_PROPERTY,
          },
          required: ["code"],
        },
        handler: async (a) => {
          const code = coerceString(a.code ?? "");
          const runtime = parseRuntime(a.runtime);
          const timeout = clampTimeout(a.timeout);
          const parsedSecrets = parseSecretsArg(a.secrets);
          if (typeof parsedSecrets === "string") return parsedSecrets;
          const resolved = await resolveSubprocessSecrets(parsedSecrets);
          if (typeof resolved === "string") return resolved;
          return runExecuteCode(code, runtime, timeout, resolved);
        },
      },
    ],
    CAPABILITIES_TOOLS_RETURNS,
  );
}
