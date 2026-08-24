import {
  attachToolReturns,
  getToolConversationId,
  toolError,
  toolResult,
  type ToolSetRegistry,
} from "@freeanima/habitat/core/tool";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  jsonValueSchema,
  workflowDefinitionSchema,
  workflowStepSchema,
  type WorkflowStep,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { z } from "zod";
import { getRuntimeDeps } from "@freeanima/habitat/platform/service/runtime-context.ts";
import { runAutoLlm } from "@freeanima/habitat/platform/service/auto-llm-run.ts";

import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  getWorkflowByName,
  listWorkflows,
  updateWorkflow,
} from "./workflow-store.ts";
import { defaultLoadNamedWorkflow, runWorkflow } from "./runner.ts";
import { validateWorkflowDefinition } from "./validate-workflow-definition.ts";

const WORLD_ID_OPTIONAL = {
  world_id: {
    type: "integer",
    description:
      "Optional world override; otherwise subject_id or conversation subject selects the private world",
  },
  subject_id: {
    type: "integer",
    description:
      "Owning subject entity id (required unless world_id or conversation tool context resolves world)",
  },
} as const;

function parseSubjectId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

async function resolveWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    const subjectId = parseSubjectId(opts.args.subject_id);
    const access = opts.access ?? "read";
    if (explicit != null) {
      return await resolveToolWorld({ explicitWorldId: explicit, access });
    }
    if (opts.entityId != null && opts.entityId > 0) {
      return await resolveToolWorld({ entityId: opts.entityId, access });
    }
    if (subjectId != null) {
      return await resolveToolWorld({ subjectId, access });
    }
    try {
      return await resolveToolWorld({ access });
    } catch (inner) {
      const innerMsg = inner instanceof Error ? inner.message : String(inner);
      if (innerMsg.includes("subject_id") || innerMsg.includes("tool caller subject")) {
        return toolError(
          "subject_id is required when world_id omitted and no tool conversation subject",
        );
      }
      throw inner;
    }
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

function rowPayload(row: Awaited<ReturnType<typeof getWorkflow>>) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    summary: row.summary,
    content: row.content,
    steps: row.steps,
    input_schema: row.input_schema ?? null,
    output_schema: row.output_schema ?? null,
    origin: row.origin,
    status: row.status,
    allowed_tools: row.allowed_tools,
    denied_tools: row.denied_tools,
    pure: row.pure ?? null,
    world_id: row.world_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildValidateCtxSync(
  toolSets: ToolSetRegistry,
  named: Map<
    string,
    { input_schema?: Record<string, unknown>; output_schema?: Record<string, unknown> }
  >,
) {
  return {
    getTool: (name: string) => {
      const t = toolSets.getTool(name);
      if (!t) return null;
      return {
        parameters: t.parameters,
        ...(t.returnSchema ? { returnSchema: t.returnSchema } : {}),
      };
    },
    getNamedWorkflow: (name: string) => named.get(name) ?? null,
  };
}

async function collectNamedChildren(
  worldId: number,
  steps: WorkflowStep[],
): Promise<
  Map<string, { input_schema?: Record<string, unknown>; output_schema?: Record<string, unknown> }>
> {
  const map = new Map<
    string,
    { input_schema?: Record<string, unknown>; output_schema?: Record<string, unknown> }
  >();
  for (const step of steps) {
    if (step.type !== "workflow") continue;
    if (map.has(step.name)) continue;
    const row = await getWorkflowByName(worldId, step.name);
    if (row) {
      map.set(step.name, {
        ...(row.input_schema ? { input_schema: row.input_schema } : {}),
        ...(row.output_schema ? { output_schema: row.output_schema } : {}),
      });
    } else {
      map.set(step.name, {});
    }
  }
  return map;
}

function runnerDeps(toolSets: ToolSetRegistry) {
  const runtime = getRuntimeDeps();
  return {
    toolSets,
    config: runtime.engine.config.data,
    runAutoLlm,
    runtimeDeps: runtime,
    loadNamedWorkflow: defaultLoadNamedWorkflow,
  };
}

export function registerWorkflowTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "workflow",
    "Deterministic multi-step Workflow graphs (temporary run or named save); ValueRef bindings; llm steps via AutoLlm",
    attachToolReturns(
      [
        {
          name: "workflow_list",
          description: "List named Workflow entities in the world",
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args });
            if (typeof worldId === "string") return worldId;
            const items = await listWorkflows(worldId);
            return toolResult({
              ok: true,
              action: "list",
              count: items.length,
              items: items.map((r) => rowPayload(r)),
            });
          },
        },
        {
          name: "workflow_get",
          description: "Get a Workflow by id or name",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
              name: { type: "string" },
            },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args });
            if (typeof worldId === "string") return worldId;
            const id = args.id != null ? Number(args.id) : undefined;
            let row = null;
            if (id != null && Number.isFinite(id) && id > 0) {
              row = await getWorkflow(Math.floor(id));
              if (row && row.world_id !== worldId) row = null;
            } else if (typeof args.name === "string") {
              row = await getWorkflowByName(worldId, args.name);
            } else {
              return toolError("id or name is required");
            }
            if (!row) return toolError("workflow not found");
            return toolResult({ ok: true, action: "get", item: rowPayload(row) });
          },
        },
        {
          name: "workflow_save",
          description: "Save (create) a named Workflow definition after static validation",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              name: { type: "string", description: "Workflow name (lowercase kebab)" },
              summary: { type: "string" },
              content: { type: "string" },
              steps: { type: "array", description: "WorkflowStep[]" },
              input_schema: { type: "object" },
              output_schema: { type: "object" },
              allowed_tools: { type: "array", items: { type: "string" } },
              denied_tools: { type: "array", items: { type: "string" } },
              status: { type: "string", enum: ["draft", "active", "discarded"] },
              strict_schema: { type: "boolean" },
            },
            required: ["subject_id", "name", "steps"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args, access: "write" });
            if (typeof worldId === "string") return worldId;
            const parsed = workflowDefinitionSchema.safeParse({
              name: args.name,
              summary: args.summary,
              content: args.content,
              steps: args.steps,
              input_schema: args.input_schema,
              output_schema: args.output_schema,
              allowed_tools: args.allowed_tools,
              denied_tools: args.denied_tools,
              status: args.status,
            });
            if (!parsed.success) {
              return toolError(`invalid workflow definition: ${parsed.error.message}`);
            }
            if (!parsed.data.name) return toolError("name is required");
            const named = await collectNamedChildren(worldId, parsed.data.steps);
            const v = validateWorkflowDefinition(parsed.data, {
              ...buildValidateCtxSync(toolSets, named),
              strict_schema: args.strict_schema === true,
            });
            if (!v.ok) {
              return toolError(
                `workflow validation failed: ${v.errors.map((e) => e.message).join("; ")}`,
              );
            }
            try {
              const row = await createWorkflow(
                worldId,
                omitUndefined({
                  name: parsed.data.name,
                  summary: parsed.data.summary,
                  content: parsed.data.content,
                  steps: parsed.data.steps,
                  input_schema: parsed.data.input_schema,
                  output_schema: parsed.data.output_schema,
                  allowed_tools: parsed.data.allowed_tools,
                  denied_tools: parsed.data.denied_tools,
                  status: parsed.data.status,
                  origin: parsed.data.origin,
                  pure: parsed.data.pure,
                }),
              );
              return toolResult({
                ok: true,
                action: "save",
                item: rowPayload(row),
                warnings: v.warnings,
              });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : String(err));
            }
          },
        },
        {
          name: "workflow_update",
          description: "Update a named Workflow; re-validates steps when provided",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
              name: { type: "string" },
              summary: { type: "string" },
              content: { type: "string" },
              steps: { type: "array" },
              input_schema: { type: "object" },
              output_schema: { type: "object" },
              allowed_tools: { type: "array", items: { type: "string" } },
              denied_tools: { type: "array", items: { type: "string" } },
              status: { type: "string", enum: ["draft", "active", "discarded"] },
              strict_schema: { type: "boolean" },
            },
            required: ["subject_id", "id"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args, access: "write" });
            if (typeof worldId === "string") return worldId;
            const id = Number(args.id);
            if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
            const existing = await getWorkflow(Math.floor(id));
            if (!existing || existing.world_id !== worldId) {
              return toolError("workflow not found");
            }
            const stepsRaw = args.steps ?? existing.steps;
            const stepsParsed = z.array(workflowStepSchema).safeParse(stepsRaw);
            if (!stepsParsed.success) {
              return toolError(`invalid steps: ${stepsParsed.error.message}`);
            }
            const def = workflowDefinitionSchema.parse({
              name: typeof args.name === "string" ? args.name : existing.name,
              summary: typeof args.summary === "string" ? args.summary : existing.summary,
              content: typeof args.content === "string" ? args.content : existing.content,
              steps: stepsParsed.data,
              input_schema: args.input_schema ?? existing.input_schema,
              output_schema: args.output_schema ?? existing.output_schema,
              allowed_tools: args.allowed_tools ?? existing.allowed_tools,
              denied_tools: args.denied_tools ?? existing.denied_tools,
              status: args.status ?? existing.status,
              origin: existing.origin,
              pure: existing.pure,
            });
            const named = await collectNamedChildren(worldId, def.steps);
            const v = validateWorkflowDefinition(def, {
              ...buildValidateCtxSync(toolSets, named),
              strict_schema: args.strict_schema === true,
            });
            if (!v.ok) {
              return toolError(
                `workflow validation failed: ${v.errors.map((e) => e.message).join("; ")}`,
              );
            }
            try {
              const row = await updateWorkflow(
                worldId,
                omitUndefined({
                  id: Math.floor(id),
                  name: def.name,
                  summary: def.summary,
                  content: def.content,
                  steps: def.steps,
                  input_schema: def.input_schema,
                  output_schema: def.output_schema,
                  allowed_tools: def.allowed_tools,
                  denied_tools: def.denied_tools,
                  status: def.status,
                  pure: def.pure,
                }),
              );
              return toolResult({
                ok: true,
                action: "update",
                item: rowPayload(row),
                warnings: v.warnings,
              });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : String(err));
            }
          },
        },
        {
          name: "workflow_delete",
          description: "Delete a named Workflow entity",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
            },
            required: ["subject_id", "id"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args, access: "write" });
            if (typeof worldId === "string") return worldId;
            const id = Number(args.id);
            if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
            try {
              await deleteWorkflow(worldId, Math.floor(id));
              return toolResult({ ok: true, action: "delete", id: Math.floor(id) });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : String(err));
            }
          },
        },
        {
          name: "workflow_run",
          description:
            "Run a Workflow: pass name (named) XOR steps (ephemeral). Optional debug returns mid-step outputs (not persisted).",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              name: { type: "string" },
              steps: { type: "array", description: "Ephemeral WorkflowStep[]" },
              input: { type: "object" },
              debug: { type: "boolean" },
              strict_schema: { type: "boolean" },
            },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const worldId = await resolveWorld({ args });
            if (typeof worldId === "string") return worldId;
            const subjectId = parseSubjectId(args.subject_id);
            if (subjectId == null) return toolError("subject_id is required");
            const hasName = typeof args.name === "string" && args.name.trim().length > 0;
            const hasSteps = Array.isArray(args.steps);
            if (hasName === hasSteps) {
              return toolError("provide exactly one of name or steps");
            }
            const input = jsonValueSchema.parse(args.input ?? {});
            let steps: WorkflowStep[];
            let name: string | null = null;
            let entityId: number | null = null;
            let allowed_tools: string[] = [];
            let denied_tools: string[] = [];

            if (hasName) {
              const row = await getWorkflowByName(worldId, String(args.name));
              if (!row) return toolError(`workflow not found: ${String(args.name)}`);
              steps = row.steps;
              name = row.name;
              entityId = row.id;
              allowed_tools = row.allowed_tools;
              denied_tools = row.denied_tools;
            } else {
              const parsed = z.array(workflowStepSchema).safeParse(args.steps);
              if (!parsed.success) {
                return toolError(`invalid steps: ${parsed.error.message}`);
              }
              steps = parsed.data;
              const def = workflowDefinitionSchema.parse({ steps });
              const named = await collectNamedChildren(worldId, steps);
              const v = validateWorkflowDefinition(def, {
                ...buildValidateCtxSync(toolSets, named),
                strict_schema: args.strict_schema === true,
              });
              if (!v.ok) {
                return toolError(
                  `workflow validation failed: ${v.errors.map((e) => e.message).join("; ")}`,
                );
              }
            }

            const parentConversationId = getToolConversationId() ?? undefined;
            const result = await runWorkflow(
              {
                worldId,
                subjectId,
                workflowEntityId: entityId,
                name,
                steps,
                input,
                allowed_tools,
                denied_tools,
                debug: args.debug === true,
                ...(parentConversationId ? { parentConversationId } : {}),
              },
              runnerDeps(toolSets),
            );
            if (result.status !== "completed") {
              return toolError(`${result.error ?? "workflow failed"} (run_id=${result.run_id})`);
            }
            return toolResult({
              ok: true,
              action: "run",
              run_id: result.run_id,
              output: result.output,
              ...(result.steps ? { steps: result.steps } : {}),
            });
          },
        },
      ],
      {},
    ),
  );
}
