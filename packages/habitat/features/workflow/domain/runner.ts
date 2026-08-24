import {
  composeAutoLlmPrompt,
  formatAutoLlmTaskSpec,
  AUTO_LLM_DEFAULT_MAX_DURATION_MS,
} from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { resolveScene } from "@freeanima/habitat/core/config/llm-config.ts";
import type { RuntimeConfig } from "@freeanima/habitat/core/config/schemas/runtime-config.ts";
import type {
  JsonValue,
  WorkflowStep,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { jsonValueSchema } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import {
  finishWorkflowRun,
  getLatestSuccessfulWorkflowRun,
  insertRunningWorkflowRun,
} from "@freeanima/habitat/core/db/pg/workflow-run";
import {
  expandToolNames,
  validateToolArgs,
  type ToolSetRegistry,
} from "@freeanima/habitat/core/tool";
import type {
  AutoLlmRunInput,
  AutoLlmRunResult,
} from "@freeanima/habitat/platform/service/auto-llm-run.ts";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { FullRuntimeDeps } from "@freeanima/habitat/platform/service/runtime-deps.ts";

import { runTransformOp } from "./transform.ts";
import type {
  WorkflowRunResult,
  WorkflowStepDebug,
  WorkflowVarRoot,
  WorkflowRow,
} from "./types.ts";
import { getWorkflowByName } from "./workflow-store.ts";
import {
  promptToValueRef,
  resolveArgsRecord,
  resolveValueRef,
  ValueRefResolveError,
} from "./value-ref.ts";

export type WorkflowRunnerDeps = {
  toolSets: ToolSetRegistry;
  config: RuntimeConfig;
  runAutoLlm: (deps: FullRuntimeDeps, input: AutoLlmRunInput) => Promise<AutoLlmRunResult>;
  runtimeDeps: FullRuntimeDeps;
  loadNamedWorkflow: (worldId: number, name: string) => Promise<WorkflowRow | null>;
};

export type WorkflowRunRequest = {
  worldId: number;
  subjectId: number;
  workflowEntityId?: number | null;
  name?: string | null;
  steps: WorkflowStep[];
  input: JsonValue;
  allowed_tools?: string[];
  denied_tools?: string[];
  debug?: boolean;
  nested?: boolean;
  parentConversationId?: string;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function executeToolStep(
  step: Extract<WorkflowStep, { type: "tool" }>,
  root: WorkflowVarRoot,
  deps: WorkflowRunnerDeps,
  policyTools: Set<string> | null,
): Promise<JsonValue> {
  if (policyTools && !policyTools.has(step.tool)) {
    throw new Error(`tool "${step.tool}" denied by workflow capability policy`);
  }
  const tool = deps.toolSets.getTool(step.tool);
  if (!tool) throw new Error(`tool not found: ${step.tool}`);
  const args = resolveArgsRecord(step.args, root);
  const validated = validateToolArgs(tool.parameters, { ...args, _title: `workflow:${step.id}` });
  if (!validated.ok) {
    throw new Error(`tool args invalid for ${step.tool}: ${validated.error}`);
  }
  const maxAttempts = Math.max(1, step.retry?.max ?? 1);
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const raw = await tool.handler(validated.data);
      const parsedJson = (() => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return raw;
        }
      })();
      const asJson = jsonValueSchema.safeParse(parsedJson);
      if (!asJson.success) {
        throw new Error(`tool ${step.tool} returned non-JSON value`);
      }
      return asJson.data;
    } catch (err) {
      lastErr = err;
      if (i + 1 < maxAttempts) {
        await sleepMs(step.retry?.backoff_ms ?? 0);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function executeLlmStep(
  step: Extract<WorkflowStep, { type: "llm" }>,
  root: WorkflowVarRoot,
  req: WorkflowRunRequest,
  deps: WorkflowRunnerDeps,
  workflowName: string | null,
): Promise<JsonValue> {
  const scenario = step.scenario ?? "chat";
  let model: string | undefined;
  try {
    model = resolveScene(deps.config, scenario).model;
  } catch (err) {
    throw new Error(
      `llm step "${step.id}" scenario "${scenario}" unresolved: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  const promptVal = resolveValueRef(promptToValueRef(step.prompt), root);
  const promptText = typeof promptVal === "string" ? promptVal : JSON.stringify(promptVal, null, 2);
  let dataParts: { tag: string; body: string }[] | undefined;
  if (step.context != null) {
    const ctxVal = resolveValueRef(step.context, root);
    dataParts = [
      {
        tag: "workflow_context",
        body: typeof ctxVal === "string" ? ctxVal : JSON.stringify(ctxVal, null, 2),
      },
    ];
  }
  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "workflow_llm",
    taskSpec: formatAutoLlmTaskSpec("workflow_llm", promptText),
    ...(dataParts ? { dataParts } : {}),
  });

  const allow = step.allowed_tools?.length
    ? expandToolNames(deps.toolSets, step.allowed_tools)
    : [];
  const deny = new Set(
    expandToolNames(deps.toolSets, [...(req.denied_tools ?? []), ...(step.denied_tools ?? [])]),
  );
  const toolNames = allow.filter((n) => !deny.has(n));

  const result = await deps.runAutoLlm(
    deps.runtimeDeps,
    omitUndefined({
      runName: `workflow:${workflowName ?? "ephemeral"}:${step.id}`,
      runKind: "workflow_llm",
      subjectId: req.subjectId,
      systemPrompt,
      userMessages,
      model,
      toolNames,
      maxLoopIterations: step.max_loop_iterations ?? 8,
      maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
      metadata: {
        step_id: step.id,
        scenario,
        workflow_entity_id: req.workflowEntityId ?? null,
      },
      parentConversationId: req.parentConversationId,
    }),
  );
  if (result.status !== "ok") {
    throw new Error(result.error ?? `llm step "${step.id}" failed`);
  }
  return result.output;
}

export async function runWorkflow(
  req: WorkflowRunRequest,
  deps: WorkflowRunnerDeps,
): Promise<WorkflowRunResult> {
  let last = null;
  if (!req.nested && (req.workflowEntityId != null || req.name)) {
    last =
      req.workflowEntityId != null
        ? await getLatestSuccessfulWorkflowRun({
            workflow_entity_id: req.workflowEntityId,
          })
        : await getLatestSuccessfulWorkflowRun(
            req.name != null && req.name.length > 0
              ? { name: req.name, world_id: req.worldId }
              : { world_id: req.worldId },
          );
  }

  const root: WorkflowVarRoot = {
    input: req.input,
    prev: undefined,
    step: {},
    last_run:
      last != null
        ? {
            id: last.id,
            output: jsonValueSchema.parse(last.output ?? null),
          }
        : null,
  };

  const policyTools =
    req.allowed_tools != null && req.allowed_tools.length > 0
      ? new Set(expandToolNames(deps.toolSets, req.allowed_tools))
      : null;

  const runRow = await insertRunningWorkflowRun({
    workflow_entity_id: req.nested ? null : (req.workflowEntityId ?? null),
    name: req.nested ? null : (req.name ?? null),
    input: req.input,
    subject_id: req.subjectId,
    world_id: req.worldId,
  });

  const debugSteps: WorkflowStepDebug[] = [];
  let lastOutput: JsonValue = null;

  try {
    for (const step of req.steps) {
      let output: JsonValue;
      switch (step.type) {
        case "tool":
          output = await executeToolStep(step, root, deps, policyTools);
          break;
        case "llm":
          output = await executeLlmStep(step, root, req, deps, req.name ?? null);
          break;
        case "transform":
          output = runTransformOp(step.op, root);
          break;
        case "workflow": {
          const childInput = resolveValueRef(step.input, root);
          const child = await deps.loadNamedWorkflow(req.worldId, step.name);
          if (!child) throw new Error(`named workflow not found: ${step.name}`);
          const childResult = await runWorkflow(
            {
              worldId: req.worldId,
              subjectId: req.subjectId,
              workflowEntityId: child.id,
              name: child.name,
              steps: child.steps,
              input: childInput,
              allowed_tools: child.allowed_tools,
              denied_tools: [...(req.denied_tools ?? []), ...child.denied_tools],
              nested: true,
              ...(req.parentConversationId
                ? { parentConversationId: req.parentConversationId }
                : {}),
            },
            deps,
          );
          if (childResult.status !== "completed") {
            throw new Error(childResult.error ?? `child workflow "${step.name}" failed`);
          }
          output = childResult.output;
          break;
        }
        default: {
          const _exhaustive: never = step;
          throw new Error(`unknown step type: ${JSON.stringify(_exhaustive)}`);
        }
      }
      root.step[step.id] = { output };
      root.prev = output;
      lastOutput = output;
      if (req.debug) {
        debugSteps.push({ id: step.id, type: step.type, output });
      }
    }

    await finishWorkflowRun({
      id: runRow.id,
      status: "completed",
      output: lastOutput,
    });

    return {
      run_id: runRow.id,
      output: lastOutput,
      status: "completed",
      ...(req.debug ? { steps: debugSteps } : {}),
    };
  } catch (err) {
    const message =
      err instanceof ValueRefResolveError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    await finishWorkflowRun({
      id: runRow.id,
      status: "failed",
      error: message,
      output: lastOutput,
    });
    return {
      run_id: runRow.id,
      output: lastOutput,
      status: "failed",
      error: message,
      ...(req.debug ? { steps: debugSteps } : {}),
    };
  }
}

export function defaultLoadNamedWorkflow(
  worldId: number,
  name: string,
): Promise<WorkflowRow | null> {
  return getWorkflowByName(worldId, name);
}
