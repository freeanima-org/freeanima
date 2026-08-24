import type {
  JsonValue,
  ValueRef,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { jsonValueSchema } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import type { WorkflowVarRoot } from "./types.ts";

export class ValueRefResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueRefResolveError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asJsonValue(value: unknown, label: string): JsonValue {
  const parsed = jsonValueSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValueRefResolveError(`${label}: value is not JSON-compatible`);
  }
  return parsed.data;
}

/** 沿 path 下钻；缺失或类型不对 → 抛错 */
export function digPath(value: unknown, path: readonly string[] | undefined): JsonValue {
  if (path == null || path.length === 0) {
    return asJsonValue(value, "digPath");
  }
  let cur: unknown = value;
  for (const segment of path) {
    if (Array.isArray(cur)) {
      const idx = Number(segment);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) {
        throw new ValueRefResolveError(`path segment "${segment}" out of array bounds`);
      }
      cur = cur[idx];
      continue;
    }
    if (!isRecord(cur) || !(segment in cur)) {
      throw new ValueRefResolveError(`path segment "${segment}" not found`);
    }
    cur = cur[segment];
  }
  return asJsonValue(cur, "digPath");
}

export function resolveValueRef(ref: ValueRef, root: WorkflowVarRoot): JsonValue {
  switch (ref.ref) {
    case "literal":
      return ref.value;
    case "input":
      return digPath(root.input, ref.path);
    case "prev": {
      if (root.prev === undefined) {
        throw new ValueRefResolveError("$prev is unavailable (no previous step)");
      }
      return digPath(root.prev, ref.path);
    }
    case "step": {
      const hit = root.step[ref.id];
      if (!hit) {
        throw new ValueRefResolveError(`$step.${ref.id} is unavailable`);
      }
      return digPath(hit.output, ref.path);
    }
    case "last_run": {
      if (root.last_run == null) {
        throw new ValueRefResolveError("$last_run is unavailable");
      }
      if (ref.path == null || ref.path.length === 0) {
        return root.last_run.output;
      }
      if (ref.path[0] === "output") {
        return digPath(root.last_run.output, ref.path.slice(1));
      }
      if (ref.path[0] === "id" && ref.path.length === 1) {
        return root.last_run.id;
      }
      return digPath(root.last_run, ref.path);
    }
    case "object": {
      const out: Record<string, JsonValue> = {};
      for (const [key, child] of Object.entries(ref.fields)) {
        out[key] = resolveValueRef(child, root);
      }
      return out;
    }
    case "array":
      return ref.items.map((item) => resolveValueRef(item, root));
    default: {
      const _exhaustive: never = ref;
      throw new ValueRefResolveError(`unknown ValueRef: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** 解析 tool args：每个字段 ValueRef → 普通对象 */
export function resolveArgsRecord(
  args: Record<string, ValueRef>,
  root: WorkflowVarRoot,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, ref] of Object.entries(args)) {
    out[key] = resolveValueRef(ref, root);
  }
  return out;
}

export function promptToValueRef(prompt: string | ValueRef): ValueRef {
  return typeof prompt === "string" ? { ref: "literal", value: prompt } : prompt;
}
