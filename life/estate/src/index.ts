/** Estate layer (notes/credentials/assets); see docs/concepts/architecture.md and docs/guide/security.md */
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerEmailTools } from "./email/tools.ts";

export const LIFE_ESTATE_PACKAGE = "@freeanima/life-estate" as const;

export * from "./email/index.ts";
export { registerEmailTools };

export function registerEstateTools(toolSets: ToolSetRegistry): void {
  registerEmailTools(toolSets);
}
