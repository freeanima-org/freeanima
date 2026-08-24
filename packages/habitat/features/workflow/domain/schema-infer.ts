import type {
  JsonValue,
  TransformOp,
  ValueRef,
  WorkflowStep,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import type { JsonSchemaObject } from "@freeanima/habitat/core/tool/registry.ts";

export type InferredSchema = JsonSchemaObject | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function digSchema(
  schema: InferredSchema,
  path: readonly string[] | undefined,
): InferredSchema {
  if (schema == null) return null;
  if (path == null || path.length === 0) return schema;
  let cur: unknown = schema;
  for (const segment of path) {
    if (!isRecord(cur)) return null;
    const typ = cur.type;
    if (typ === "array") {
      const items = cur.items;
      if (!isRecord(items)) return null;
      cur = items;
      // array index path segment consumed as "into items"
      continue;
    }
    const props = cur.properties;
    if (!isRecord(props) || !(segment in props)) return null;
    cur = props[segment];
  }
  return isRecord(cur) ? cur : null;
}

export function schemaTypeOf(schema: InferredSchema): string | undefined {
  if (schema == null) return undefined;
  const t = schema.type;
  return typeof t === "string" ? t : undefined;
}

/** 保守兼容：叶子 type 冲突 → false；缺 schema → null（未知） */
export function schemasCompatible(
  expected: InferredSchema,
  actual: InferredSchema,
): boolean | null {
  if (expected == null || actual == null) return null;
  const et = schemaTypeOf(expected);
  const at = schemaTypeOf(actual);
  if (et == null || at == null) return null;
  if (et === at) return true;
  if (et === "integer" && at === "number") return true;
  if (et === "number" && at === "integer") return true;
  return false;
}

export function inferLiteralSchema(value: JsonValue): InferredSchema {
  if (value === null) return { type: "null" };
  if (typeof value === "string") return { type: "string" };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }
  if (typeof value === "boolean") return { type: "boolean" };
  if (Array.isArray(value)) {
    return { type: "array", items: value[0] != null ? inferLiteralSchema(value[0]) : {} };
  }
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    properties[k] = inferLiteralSchema(v);
  }
  return { type: "object", properties };
}

export function inferTransformOutputSchema(
  op: TransformOp,
  resolveFrom: (from: ValueRef) => InferredSchema,
): InferredSchema {
  switch (op.op) {
    case "pick": {
      const from = resolveFrom(op.from);
      if (from == null) return { type: "object" };
      const props: Record<string, unknown> = {};
      const srcProps = isRecord(from.properties) ? from.properties : {};
      for (const key of op.keys) {
        if (key in srcProps) props[key] = srcProps[key];
      }
      return { type: "object", properties: props };
    }
    case "get":
      return digSchema(resolveFrom(op.from), op.path);
    case "pluck":
      return { type: "array", items: digSchema(resolveFrom(op.from), op.path) ?? {} };
    case "filter_eq":
    case "filter_includes":
      return resolveFrom(op.from) ?? { type: "array" };
    case "merge":
    case "template_object":
      return { type: "object" };
    default:
      return null;
  }
}

export function inferStepOutputSchema(
  step: WorkflowStep,
  opts: {
    toolReturnSchema?: (toolName: string) => InferredSchema;
    childOutputSchema?: (name: string) => InferredSchema;
    resolveValueRefSchema: (ref: ValueRef) => InferredSchema;
  },
): InferredSchema {
  switch (step.type) {
    case "tool":
      return opts.toolReturnSchema?.(step.tool) ?? null;
    case "llm":
      return { type: "string" };
    case "workflow":
      return opts.childOutputSchema?.(step.name) ?? null;
    case "transform":
      return inferTransformOutputSchema(step.op, opts.resolveValueRefSchema);
    default:
      return null;
  }
}
