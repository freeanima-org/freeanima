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

let engine: RetainEngineFn | null = null;

export function registerRetainEngine(fn: RetainEngineFn): void {
  engine = fn;
}

export function resetRetainEngineForTests(): void {
  engine = null;
}

export function tryGetRetainEngine(): RetainEngineFn | null {
  return engine;
}

export async function runRetainEngine(input: RetainEngineInput): Promise<RetainEngineResult> {
  if (!engine) return { items: [] };
  return engine(input);
}
