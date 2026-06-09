/** 资源层（笔记/凭证/资产）；详见 ARCHITECTURE.md 与 docs/security.md */
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerEmailTools } from "./email/tools.ts";

export const LIFE_ESTATE_PACKAGE = "@freeanima/life-estate" as const;

export * from "./email/index.ts";
export { registerEmailTools };

export function registerEstateTools(toolSets: ToolSetRegistry): void {
  registerEmailTools(toolSets);
}
