import type { ReflectInput, ReflectResult } from "./types.ts";
import { runBuiltinReflect } from "./builtin-reflect.ts";
import { omitUndefined } from "@freeanima/habitat/core/util";

/**
 * reflect 巩固作业（#16102 / #18010）。
 * 默认按簇单轮有序巩固；测试可 registerReflectEngine 覆盖。
 */

export type ReflectEngineInput = {
  conversation_ids?: string[];
  force?: boolean;
};

export type ReflectEngineResult = ReflectResult & {
  summary?: string;
};

export type ReflectEngineFn = (input: ReflectEngineInput) => Promise<ReflectEngineResult>;

let engine: ReflectEngineFn | null = null;

export function registerReflectEngine(fn: ReflectEngineFn): void {
  engine = fn;
}

export function resetReflectEngineForTests(): void {
  engine = null;
}

export async function runReflectEngine(
  input: ReflectEngineInput = {},
): Promise<ReflectEngineResult> {
  if (engine) return engine(input);
  return runBuiltinReflect(input);
}

export async function defaultReflect(input: ReflectInput = {}): Promise<ReflectResult> {
  const result = await runReflectEngine(
    omitUndefined({
      conversation_ids: input.conversation_ids,
      force: input.force,
    }),
  );
  return {
    merged: result.merged,
    deprecated: result.deprecated,
    conflicts: result.conflicts,
  };
}
