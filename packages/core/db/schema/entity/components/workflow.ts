import { WORKFLOW_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { WORKFLOW_COMPONENT };

import { z } from "zod";

/** 与 text_generate 子场景对齐（见 TEXT_GENERATE_PURPOSE_IDS） */
export const WORKFLOW_SCENARIO_IDS = [
  "chat",
  "summary",
  "reflect",
  "goal_judge",
  "skill_review",
] as const;

/** name：小写字母数字与连字符，≤64（对齐 skill） */
export const WORKFLOW_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidWorkflowName(name: string): boolean {
  return WORKFLOW_NAME_RE.test(name);
}

export const workflowOriginSchema = z.enum(["builtin", "user", "imported", "evolved"]);
export type WorkflowOrigin = z.infer<typeof workflowOriginSchema>;

export const workflowStatusSchema = z.enum(["draft", "active", "discarded"]);
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const workflowScenarioSchema = z.enum(WORKFLOW_SCENARIO_IDS);
export type WorkflowScenario = z.infer<typeof workflowScenarioSchema>;

/** JSON 叶子与容器（ValueRef literal / transform 用） */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/**
 * 结构化数据绑定（类型安全；禁止 jp:/jq 自由字符串）。
 * path 为段数组，空或缺省 = 整值。
 */
export type ValueRef =
  | { ref: "literal"; value: JsonValue }
  | { ref: "input"; path?: string[] | undefined }
  | { ref: "prev"; path?: string[] | undefined }
  | { ref: "step"; id: string; path?: string[] | undefined }
  | { ref: "last_run"; path?: string[] | undefined }
  | { ref: "object"; fields: Record<string, ValueRef> }
  | { ref: "array"; items: ValueRef[] };

export const valueRefSchema: z.ZodType<ValueRef> = z.lazy(() =>
  z.discriminatedUnion("ref", [
    z.object({ ref: z.literal("literal"), value: jsonValueSchema }),
    z.object({
      ref: z.literal("input"),
      path: z.array(z.string().min(1)).optional(),
    }),
    z.object({
      ref: z.literal("prev"),
      path: z.array(z.string().min(1)).optional(),
    }),
    z.object({
      ref: z.literal("step"),
      id: z.string().min(1),
      path: z.array(z.string().min(1)).optional(),
    }),
    z.object({
      ref: z.literal("last_run"),
      path: z.array(z.string().min(1)).optional(),
    }),
    z.object({
      ref: z.literal("object"),
      fields: z.record(z.string(), valueRefSchema),
    }),
    z.object({
      ref: z.literal("array"),
      items: z.array(valueRefSchema),
    }),
  ]),
);

export const workflowRetrySchema = z.object({
  max: z.number().int().positive().max(10),
  backoff_ms: z.number().int().nonnegative().max(60_000).default(0),
});
export type WorkflowRetry = z.infer<typeof workflowRetrySchema>;

export const transformOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("pick"),
    from: valueRefSchema,
    keys: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    op: z.literal("get"),
    from: valueRefSchema,
    path: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    op: z.literal("pluck"),
    from: valueRefSchema,
    path: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    op: z.literal("filter_eq"),
    from: valueRefSchema,
    path: z.array(z.string().min(1)).min(1),
    equals: jsonValueSchema,
  }),
  z.object({
    op: z.literal("filter_includes"),
    from: valueRefSchema,
    path: z.array(z.string().min(1)).min(1),
    value: jsonValueSchema,
  }),
  z.object({
    op: z.literal("merge"),
    items: z.array(valueRefSchema).min(1),
  }),
  z.object({
    op: z.literal("template_object"),
    fields: z.record(z.string(), valueRefSchema),
  }),
]);
export type TransformOp = z.infer<typeof transformOpSchema>;

const stepIdSchema = z.string().min(1).max(64);

export const workflowToolStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal("tool"),
  tool: z.string().min(1),
  args: z.record(z.string(), valueRefSchema).default({}),
  pure: z.boolean().optional(),
  retry: workflowRetrySchema.optional(),
  retryable: z.boolean().optional(),
});
export type WorkflowToolStep = z.infer<typeof workflowToolStepSchema>;

export const workflowLlmStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal("llm"),
  prompt: z.union([z.string().min(1), valueRefSchema]),
  scenario: workflowScenarioSchema.optional(),
  context: valueRefSchema.optional(),
  allowed_tools: z.array(z.string()).optional(),
  denied_tools: z.array(z.string()).optional(),
  max_loop_iterations: z.number().int().positive().optional(),
  pure: z.boolean().optional(),
});
export type WorkflowLlmStep = z.infer<typeof workflowLlmStepSchema>;

export const workflowNestedStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal("workflow"),
  name: z.string().regex(WORKFLOW_NAME_RE),
  input: valueRefSchema,
  pure: z.boolean().optional(),
});
export type WorkflowNestedStep = z.infer<typeof workflowNestedStepSchema>;

export const workflowTransformStepSchema = z.object({
  id: stepIdSchema,
  type: z.literal("transform"),
  op: transformOpSchema,
});
export type WorkflowTransformStep = z.infer<typeof workflowTransformStepSchema>;

export const workflowStepSchema = z.discriminatedUnion("type", [
  workflowToolStepSchema,
  workflowLlmStepSchema,
  workflowNestedStepSchema,
  workflowTransformStepSchema,
]);
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

/** JSON Schema object（顶层 input/output 声明；保守校验用） */
export const jsonSchemaObjectSchema = z
  .object({
    type: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    required: z.array(z.string()).optional(),
    items: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
  })
  .passthrough();

/**
 * workflow body：title→name，summary→description，content→人读说明。
 * steps 为确定性图；input_schema / output_schema 供保存时静态连线。
 */
export const workflowBodySchema = z.object({
  steps: z.array(workflowStepSchema).min(1),
  input_schema: jsonSchemaObjectSchema.optional(),
  output_schema: jsonSchemaObjectSchema.optional(),
  origin: workflowOriginSchema.default("user"),
  status: workflowStatusSchema.default("active"),
  allowed_tools: z.array(z.string()).default([]),
  denied_tools: z.array(z.string()).default([]),
  pure: z.boolean().optional(),
});

export type WorkflowBody = z.infer<typeof workflowBodySchema>;

/** 临时 / 具名定义（含 name 可选；入库时 name 在 title） */
export const workflowDefinitionSchema = workflowBodySchema.extend({
  name: z.string().regex(WORKFLOW_NAME_RE).optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
});
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
