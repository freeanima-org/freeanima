/** Estate capability tools placeholder (email moved to @freeanima/capabilities-email) */
import type { ToolSetRegistry } from "@freeanima/core/tool";

export const CAPABILITIES_ESTATE_PACKAGE = "@freeanima/capabilities-tools/estate" as const;

export function registerEstateTools(_toolSets: ToolSetRegistry): void {
  // email tools registered via @freeanima/capabilities-email in register-tools.ts
}
