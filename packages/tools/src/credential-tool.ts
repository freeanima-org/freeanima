import { listCredentials, registerTool, toolResult } from "@freeanima/legacy-kernel";

export function registerCredentialTools(): void {
  registerTool({
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
  });
}
