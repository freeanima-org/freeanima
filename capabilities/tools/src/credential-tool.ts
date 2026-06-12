import type { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { attachToolReturns, toolResult } from "@freeanima/mechanism-tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { listCredentialsForCapability as listCredentials } from "@freeanima/storage-config";

export function registerCredentialTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "credentials",
    "Credential path lookup (no values)",
    attachToolReturns(
      [
        {
          name: "credentials_list",
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
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
