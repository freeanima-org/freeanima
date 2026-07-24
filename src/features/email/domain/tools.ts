import type { ToolSetRegistry } from "@freeanima/host/core/tool";

import { registerEmailAccountTools } from "./email-account-tools.ts";
import type { EmailToolIo } from "./email-tool-helpers.ts";
import { registerEmailMailboxTools } from "./email-mailbox-tools.ts";

export function registerEmailTools(toolSets: ToolSetRegistry, io: EmailToolIo): void {
  registerEmailAccountTools(toolSets, io);
  registerEmailMailboxTools(toolSets, io);
}
