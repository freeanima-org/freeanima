import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

import { buildEmailAccountToolDefs } from "./email-account-tools.ts";
import type { EmailToolIo } from "./email-tool-helpers.ts";
import { buildEmailMailboxToolDefs } from "./email-mailbox-tools.ts";

export function registerEmailTools(toolSets: ToolSetRegistry, io: EmailToolIo): void {
  toolSets.registerToolSet("email", "Email accounts, sync, and mailbox operations", [
    ...buildEmailAccountToolDefs(io),
    ...buildEmailMailboxToolDefs(io),
  ]);
}
