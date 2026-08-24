import type {
  ValueRef,
  WorkflowDefinition,
  WorkflowStep,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { WORKFLOW_SCENARIO_IDS } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import type { JsonSchemaObject } from "@freeanima/habitat/core/tool/registry.ts";
import {
  digSchema,
  inferLiteralSchema,
  inferStepOutputSchema,
  schemasCompatible,
  type InferredSchema,
} from "./schema-infer.ts";
import type { WorkflowValidateIssue, WorkflowValidateResult } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asInferredSchema(value: unknown): InferredSchema {
  if (!isRecord(value)) return null;
  return value;
}

export type ValidateWorkflowContext = {
  /** 查 tool 是否存在与 returnSchema */
  getTool?: (
    name: string,
  ) => { parameters?: JsonSchemaObject; returnSchema?: JsonSchemaObject } | null;
  /** 查具名子 Workflow 的 input/output schema */
  getNamedWorkflow?: (
    name: string,
  ) => { input_schema?: JsonSchemaObject; output_schema?: JsonSchemaObject } | null;
  /** 缺 schema 时升为 error */
  strict_schema?: boolean;
};

function walkValueRefs(ref: ValueRef, visit: (r: ValueRef) => void): void {
  visit(ref);
  if (ref.ref === "object") {
    for (const child of Object.values(ref.fields)) walkValueRefs(child, visit);
  } else if (ref.ref === "array") {
    for (const child of ref.items) walkValueRefs(child, visit);
  }
}

function refsInStep(step: WorkflowStep, visit: (r: ValueRef) => void): void {
  switch (step.type) {
    case "tool":
      for (const r of Object.values(step.args)) walkValueRefs(r, visit);
      break;
    case "llm":
      if (typeof step.prompt !== "string") walkValueRefs(step.prompt, visit);
      if (step.context) walkValueRefs(step.context, visit);
      break;
    case "workflow":
      walkValueRefs(step.input, visit);
      break;
    case "transform": {
      const op = step.op;
      if (op.op === "merge") {
        for (const r of op.items) walkValueRefs(r, visit);
      } else if (op.op === "template_object") {
        for (const r of Object.values(op.fields)) walkValueRefs(r, visit);
      } else {
        walkValueRefs(op.from, visit);
      }
      break;
    }
  }
}

function inputSchemaProperties(inputSchema: InferredSchema): Record<string, unknown> | null {
  if (inputSchema == null) return null;
  const props = inputSchema.properties;
  if (props == null || typeof props !== "object" || Array.isArray(props)) return null;
  return props;
}

export function validateWorkflowDefinition(
  def: WorkflowDefinition,
  ctx: ValidateWorkflowContext = {},
): WorkflowValidateResult {
  const errors: WorkflowValidateIssue[] = [];
  const warnings: WorkflowValidateIssue[] = [];
  const push = (issue: WorkflowValidateIssue) => {
    if (issue.severity === "error") errors.push(issue);
    else warnings.push(issue);
  };
  const missingSchemaSeverity = ctx.strict_schema ? "error" : "warning";

  const steps = def.steps;
  const idIndex = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    if (idIndex.has(step.id)) {
      push({
        step_id: step.id,
        code: "duplicate_step_id",
        message: `duplicate step id: ${step.id}`,
        severity: "error",
      });
    } else {
      idIndex.set(step.id, i);
    }
  }

  const stepOutputSchemas = new Map<string, InferredSchema>();

  const resolveRefSchema = (ref: ValueRef, beforeIndex: number): InferredSchema => {
    switch (ref.ref) {
      case "literal":
        return inferLiteralSchema(ref.value);
      case "input": {
        const inputSchema = asInferredSchema(def.input_schema);
        const props = inputSchemaProperties(inputSchema);
        if (props == null) return null;
        if (ref.path == null || ref.path.length === 0) return inputSchema;
        return digSchema(inputSchema, ref.path);
      }
      case "prev": {
        if (beforeIndex <= 0) return null;
        const prev = steps[beforeIndex - 1];
        if (!prev) return null;
        return digSchema(stepOutputSchemas.get(prev.id) ?? null, ref.path);
      }
      case "step": {
        const idx = idIndex.get(ref.id);
        if (idx == null || idx >= beforeIndex) return null;
        return digSchema(stepOutputSchemas.get(ref.id) ?? null, ref.path);
      }
      case "last_run":
        return null;
      case "object": {
        const properties: Record<string, unknown> = {};
        for (const [k, child] of Object.entries(ref.fields)) {
          properties[k] = resolveRefSchema(child, beforeIndex) ?? {};
        }
        return { type: "object", properties };
      }
      case "array":
        return { type: "array" };
      default:
        return null;
    }
  };

  const referencedInputPaths = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;

    refsInStep(step, (ref) => {
      if (ref.ref === "step") {
        const idx = idIndex.get(ref.id);
        if (idx == null) {
          push({
            step_id: step.id,
            code: "unknown_step_ref",
            message: `refers to unknown step id: ${ref.id}`,
            severity: "error",
          });
        } else if (idx >= i) {
          push({
            step_id: step.id,
            code: "forward_step_ref",
            message: `step ref "${ref.id}" must refer to a prior step`,
            severity: "error",
          });
        }
      }
      if (ref.ref === "prev" && i === 0) {
        push({
          step_id: step.id,
          code: "prev_unavailable",
          message: "first step cannot use ref:prev",
          severity: "error",
        });
      }
      if (ref.ref === "input") {
        const key = (ref.path ?? []).join(".") || "*";
        referencedInputPaths.add(key);
        const props = inputSchemaProperties(asInferredSchema(def.input_schema));
        if (props != null && ref.path != null && ref.path.length > 0) {
          const head = ref.path[0];
          if (head != null && !(head in props)) {
            push({
              step_id: step.id,
              field: head,
              code: "input_path_missing",
              message: `input path "${head}" not in input_schema.properties`,
              severity: "error",
            });
          }
        }
      }
    });

    if (step.type === "llm" && step.scenario != null) {
      if (!(WORKFLOW_SCENARIO_IDS as readonly string[]).includes(step.scenario)) {
        push({
          step_id: step.id,
          code: "invalid_scenario",
          message: `invalid scenario: ${step.scenario}`,
          severity: "error",
        });
      }
    }

    if (step.type === "tool") {
      const tool = ctx.getTool?.(step.tool) ?? null;
      if (ctx.getTool && !tool) {
        push({
          step_id: step.id,
          code: "unknown_tool",
          message: `tool not registered: ${step.tool}`,
          severity: "error",
        });
      } else if (tool?.parameters?.properties) {
        const props = tool.parameters.properties;
        const required = new Set(tool.parameters.required ?? []);
        for (const req of required) {
          if (!(req in step.args)) {
            push({
              step_id: step.id,
              field: req,
              code: "missing_required_arg",
              message: `tool ${step.tool} requires arg "${req}"`,
              severity: "error",
            });
          }
        }
        for (const [field, ref] of Object.entries(step.args)) {
          const expected = asInferredSchema(props[field]);
          if (expected == null && !(field in props)) {
            push({
              step_id: step.id,
              field,
              code: "unknown_arg",
              message: `tool ${step.tool} has no parameter "${field}"`,
              severity: "warning",
            });
            continue;
          }
          const actual = resolveRefSchema(ref, i);
          const ok = schemasCompatible(expected, actual);
          if (ok === false) {
            push({
              step_id: step.id,
              field,
              code: "arg_type_mismatch",
              message: `arg "${field}" type incompatible with tool ${step.tool} parameter`,
              severity: "error",
            });
          } else if (ok == null && ref.ref === "step") {
            push({
              step_id: step.id,
              field,
              code: "schema_unknown",
              message: `cannot verify arg "${field}" schema (upstream schema missing)`,
              severity: missingSchemaSeverity,
            });
          }
        }
      }
    }

    if (step.type === "workflow") {
      const child = ctx.getNamedWorkflow?.(step.name) ?? null;
      if (ctx.getNamedWorkflow && !child) {
        push({
          step_id: step.id,
          code: "unknown_child_workflow",
          message: `named workflow not found: ${step.name}`,
          severity: "error",
        });
      } else if (child?.input_schema) {
        const actual = resolveRefSchema(step.input, i);
        const ok = schemasCompatible(child.input_schema, actual);
        if (ok === false) {
          push({
            step_id: step.id,
            code: "child_input_mismatch",
            message: `input incompatible with child workflow ${step.name} input_schema`,
            severity: "error",
          });
        }
      }
    }

    const outSchema = inferStepOutputSchema(step, {
      toolReturnSchema: (name) => ctx.getTool?.(name)?.returnSchema ?? null,
      childOutputSchema: (name) => ctx.getNamedWorkflow?.(name)?.output_schema ?? null,
      resolveValueRefSchema: (ref) => resolveRefSchema(ref, i),
    });
    stepOutputSchemas.set(step.id, outSchema);
  }

  const props = inputSchemaProperties(asInferredSchema(def.input_schema));
  if (props != null) {
    for (const key of Object.keys(props)) {
      if (
        ![...referencedInputPaths].some((p) => p === "*" || p === key || p.startsWith(`${key}.`))
      ) {
        push({
          field: key,
          code: "unused_input",
          message: `input_schema property "${key}" is never referenced`,
          severity: "warning",
        });
      }
    }
    for (const req of def.input_schema?.required ?? []) {
      if (
        ![...referencedInputPaths].some((p) => p === "*" || p === req || p.startsWith(`${req}.`))
      ) {
        push({
          field: req,
          code: "required_input_uncovered",
          message: `required input "${req}" is not referenced by any step`,
          severity: "warning",
        });
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
