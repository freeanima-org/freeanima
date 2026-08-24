import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

import { registerWorkflowTools as registerWorkflowToolSet } from "./workflow-tools.ts";

export function registerWorkflowTools(toolSets: ToolSetRegistry): void {
  registerWorkflowToolSet(toolSets);
}

export {
  listWorkflows,
  getWorkflow,
  getWorkflowByName,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from "./workflow-store.ts";
export { runWorkflow, defaultLoadNamedWorkflow } from "./runner.ts";
export type { WorkflowRunnerDeps, WorkflowRunRequest } from "./runner.ts";
export { validateWorkflowDefinition } from "./validate-workflow-definition.ts";
export { resolveValueRef, digPath } from "./value-ref.ts";
export { runTransformOp } from "./transform.ts";
export type * from "./types.ts";
