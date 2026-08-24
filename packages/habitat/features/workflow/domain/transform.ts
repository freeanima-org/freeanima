import type {
  JsonValue,
  TransformOp,
} from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import { jsonValueSchema } from "@freeanima/habitat/core/db/schema/entity/components/workflow.ts";
import type { WorkflowVarRoot } from "./types.ts";
import { digPath, resolveValueRef, ValueRefResolveError } from "./value-ref.ts";

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

function digField(item: unknown, path: readonly string[]): unknown {
  return digPath(item, path);
}

export function runTransformOp(op: TransformOp, root: WorkflowVarRoot): JsonValue {
  switch (op.op) {
    case "pick": {
      const from = resolveValueRef(op.from, root);
      if (!isRecord(from)) {
        throw new ValueRefResolveError("transform pick: from must be an object");
      }
      const out: Record<string, JsonValue> = {};
      for (const key of op.keys) {
        if (key in from) out[key] = asJsonValue(from[key], `pick.${key}`);
      }
      return out;
    }
    case "get":
      return digPath(resolveValueRef(op.from, root), op.path);
    case "pluck": {
      const from = resolveValueRef(op.from, root);
      if (!Array.isArray(from)) {
        throw new ValueRefResolveError("transform pluck: from must be an array");
      }
      return from.map((item) => asJsonValue(digField(item, op.path), "pluck"));
    }
    case "filter_eq": {
      const from = resolveValueRef(op.from, root);
      if (!Array.isArray(from)) {
        throw new ValueRefResolveError("transform filter_eq: from must be an array");
      }
      return from.filter((item) => {
        try {
          return digField(item, op.path) === op.equals;
        } catch {
          return false;
        }
      });
    }
    case "filter_includes": {
      const from = resolveValueRef(op.from, root);
      if (!Array.isArray(from)) {
        throw new ValueRefResolveError("transform filter_includes: from must be an array");
      }
      return from.filter((item) => {
        try {
          const field = digField(item, op.path);
          if (Array.isArray(field)) return field.includes(op.value);
          if (typeof field === "string" && typeof op.value === "string") {
            return field.includes(op.value);
          }
          return false;
        } catch {
          return false;
        }
      });
    }
    case "merge": {
      const out: Record<string, JsonValue> = {};
      for (const item of op.items) {
        const resolved = resolveValueRef(item, root);
        if (!isRecord(resolved)) {
          throw new ValueRefResolveError("transform merge: each item must resolve to an object");
        }
        Object.assign(out, resolved);
      }
      return out;
    }
    case "template_object": {
      const out: Record<string, JsonValue> = {};
      for (const [key, ref] of Object.entries(op.fields)) {
        out[key] = resolveValueRef(ref, root);
      }
      return out;
    }
    default: {
      const _exhaustive: never = op;
      throw new ValueRefResolveError(`unknown transform op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
