import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountRetainEngineService } from "./retain-engine-service.ts";

/**
 * retain 引擎端口（#16102 PR2）。
 * 生产可注入 LLM；未注册时 retain 仍前进 watermark（与 retain 热路径并行抽取）。
 */

export type RetainEngineItem = {
  content: string;
  kind?: string;
  action?: "create" | "update" | "deprecate";
  id?: number;
};

export type RetainEngineInput = {
  conversation_id: string;
  message_ids: string[];
  /** user/assistant 正文（已过滤） */
  texts: string[];
};

export type RetainEngineResult = {
  items: RetainEngineItem[];
};

export type RetainEngineFn = (input: RetainEngineInput) => Promise<RetainEngineResult>;

export function registerRetainEngine(fn: RetainEngineFn): void {
  mountRetainEngineService(ensureProcessContext()).register(fn);
}

export function resetRetainEngineForTests(): void {
  getProcessContext()?.retainEngine?.reset();
}

export function tryGetRetainEngine(): RetainEngineFn | null {
  return getProcessContext()?.retainEngine?.get() ?? null;
}

export async function runRetainEngine(input: RetainEngineInput): Promise<RetainEngineResult> {
  const engine = tryGetRetainEngine();
  if (!engine) return { items: [] };
  return engine(input);
}
