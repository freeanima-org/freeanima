import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { toolResult } from "@freeanima/engine-tool";
import { listCredentials } from "@freeanima/service-config";

export function registerCredentialTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("credentials", "凭证路径查询（不含值）", [
    {
      name: "list_credentials",
      description: "List pass credential paths (no values)",
      parameters: { type: "object", properties: {} },
      handler: () =>
        toolResult({
          credentials: listCredentials().map((c) => ({
            path: c.path,
            category: c.category,
            fields: c.fields,
            tags: c.tags,
            desc: c.desc,
          })),
        }),
    },
  ]);
}
