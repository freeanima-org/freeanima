import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

import { registerSubagentTools as registerSubagentToolSet } from "./subagent-tools.ts";

export function registerSubagentTools(toolSets: ToolSetRegistry): void {
  registerSubagentToolSet(toolSets);
}

export function resetSubagentToolsForTests(): void {}

export {
  listSubagents,
  getSubagent,
  getSubagentBySlug,
  createSubagent,
  updateSubagent,
  deleteSubagent,
} from "./subagent-store.ts";
export { seedBuiltinSubagents, BUILTIN_SUBAGENT_SEEDS } from "./builtins.ts";
export {
  registerSubagentCatalogSystemPromptHook,
  formatSubagentCatalogContent,
} from "./prompt-hooks.ts";
export {
  formatSubagentRoleSection,
  formatSubagentGoalSection,
  mergePromptIncludes,
  normalizePromptIncludes,
  buildSubagentOptInSections,
} from "./subagent-prompt.ts";
export type {
  SubagentRow,
  SubagentCreateInput,
  SubagentUpdateInput,
  SubagentTaskInput,
  ResolvedSubagentProfile,
} from "./types.ts";
