/** Estate capability tools (email); I/O in @freeanima/connectors-email */
import type { ToolSetRegistry } from "@freeanima/core/tool";
import type { EmailApi } from "./email-api.ts";
import { registerEmailTools } from "./tools.ts";

export const CAPABILITIES_ESTATE_PACKAGE = "@freeanima/capabilities-estate" as const;

export type { EmailApi } from "./email-api.ts";
export { registerEmailTools };

export function registerEstateTools(toolSets: ToolSetRegistry, email: EmailApi): void {
  registerEmailTools(toolSets, email);
}
