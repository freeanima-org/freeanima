/** Estate capability tools placeholder (email tools live in @freeanima/feature-email/domain) */
import type { ToolSetRegistry } from "@freeanima/core/tool";

export const CAPABILITIES_ESTATE_PACKAGE = "@freeanima/capabilities-tools/estate" as const;

export function registerEstateTools(_toolSets: ToolSetRegistry): void {
  // email tools registered via @freeanima/feature-email/domain in register-tools.ts
}
