import type { ReflectInput, ReflectResult } from "./types.ts";
import { runBuiltinReflect } from "./builtin-reflect.ts";
import { omitUndefined } from "@freeanima/core/util";

import {
  currentReflectEngineService,
  ensureReflectEngineService,
} from "./reflect-engine-service.ts";

/**
 * reflect 巩固作业（#16102 / #18010）。
 * 默认按簇单轮有序巩固；测试可 registerReflectEngine 覆盖。
 */

export type ReflectEngineInput = {
  conversation_ids?: string[];
  force?: boolean;
  world_id?: number;
  agent_subject_id?: number;
};

export type ReflectEngineResult = ReflectResult & {
  summary?: string;
};

export type ReflectEngineFn = (input: ReflectEngineInput) => Promise<ReflectEngineResult>;

export function registerReflectEngine(fn: ReflectEngineFn): void {
  ensureReflectEngineService().register(fn);
}

export function resetReflectEngineForTests(): void {
  currentReflectEngineService()?.reset();
}

export async function runReflectEngine(
  input: ReflectEngineInput = {},
): Promise<ReflectEngineResult> {
  const engine = currentReflectEngineService()?.get() ?? null;
  if (engine) return engine(input);
  return runBuiltinReflect(input);
}

export async function defaultReflect(input: ReflectInput = {}): Promise<ReflectResult> {
  const result = await runReflectEngine(
    omitUndefined({
      conversation_ids: input.conversation_ids,
      force: input.force,
      world_id: input.world_id,
      agent_subject_id: input.agent_subject_id,
    }),
  );
  return {
    merged: result.merged,
    deprecated: result.deprecated,
    conflicts: result.conflicts,
  };
}
