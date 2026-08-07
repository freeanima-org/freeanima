import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";
import { omitUndefined } from "@freeanima/host/core/util";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ToolSetRegistry } from "./toolset.ts";

export type ToolContextKind = "conversation" | "auto_llm";

export type ToolProgressReporter = (content: string) => void;

type ToolContextStore = {
  contextId: string;
  contextKind: ToolContextKind;
  parentConversationId?: string;
  tools: ToolSetRegistry;
  /** MCP / HTTP Service API Token caller; absent for conversation LLM / AutoLlmRun */
  callerAuth?: VerifiedServiceApiToken;
  /** Acting subject for AutoLlmRun / conversation; ignored when callerAuth present */
  subjectId?: number;
  /** Mutable execution allowlist; no loaded gate when unset */
  executableTools?: Set<string>;
  /**
   * Parent conversation tool progress sink (e.g. subagent live steps).
   * Inherited by nested auto_llm contexts; only conversation loop-engine installs it.
   */
  onToolProgress?: ToolProgressReporter;
};

const storage = new AsyncLocalStorage<ToolContextStore>();

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value != null &&
    typeof value === "object" &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function"
  );
}

/** Each next() runs in conversation context; for runStream and other async generators */
async function* bindToolContext<T>(
  store: ToolContextStore,
  source: AsyncIterable<T>,
): AsyncGenerator<T> {
  const it = source[Symbol.asyncIterator]();
  while (true) {
    const step = await storage.run(store, () => it.next());
    if (step.done) return;
    yield step.value;
  }
}

export type RunWithToolContextOpts = {
  tools: ToolSetRegistry;
  executableTools?: readonly string[];
  contextKind?: ToolContextKind;
  parentConversationId?: string;
  callerAuth?: VerifiedServiceApiToken;
  /** Acting subject (AutoLlmRun); ignored when callerAuth present */
  subjectId?: number;
  /** Override progress reporter; default inherits from parent ALS store */
  onToolProgress?: ToolProgressReporter;
};

export function runWithToolContext<T>(
  contextId: string,
  fn: () => T,
  opts: RunWithToolContextOpts,
): T {
  const parent = storage.getStore();
  const store: ToolContextStore = omitUndefined({
    contextId,
    contextKind: opts.contextKind ?? "conversation",
    parentConversationId: opts.parentConversationId,
    tools: opts.tools,
    callerAuth: opts.callerAuth,
    subjectId: opts.subjectId,
    executableTools: opts.executableTools ? new Set(opts.executableTools) : undefined,
    onToolProgress: opts.onToolProgress ?? parent?.onToolProgress,
  });
  const result = storage.run(store, fn);
  if (isAsyncIterable(result)) {
    return bindToolContext(store, result) as T;
  }
  return result;
}

/** Install / clear progress reporter on the current ALS store (mutable). */
export function setToolProgressReporter(reporter: ToolProgressReporter | undefined): void {
  const store = storage.getStore();
  if (!store) return;
  if (reporter) store.onToolProgress = reporter;
  else delete store.onToolProgress;
}

/** Report partial tool result JSON to the parent conversation stream (no-op if unset). */
export function reportToolProgress(content: string): void {
  storage.getStore()?.onToolProgress?.(content);
}

export function getToolContextKind(): ToolContextKind | undefined {
  return storage.getStore()?.contextKind;
}

/** Conversation id for memory attribution; undefined in auto_llm context */
export function getToolConversationId(): string | undefined {
  const store = storage.getStore();
  if (!store || store.contextKind === "auto_llm") return undefined;
  return store.contextId;
}

export function getToolContextId(): string | undefined {
  return storage.getStore()?.contextId;
}

export function getToolParentConversationId(): string | undefined {
  return storage.getStore()?.parentConversationId;
}

export function getToolCallerAuth(): VerifiedServiceApiToken | undefined {
  return storage.getStore()?.callerAuth;
}

/**
 * Caller subject for tool world grants:
 * 1. MCP / Service API token subject
 * 2. ALS subjectId (AutoLlmRun acting subject)
 * 3. Fallback: Habitat agent_subject_id
 */
export function resolveToolCallerSubjectId(): number {
  const auth = getToolCallerAuth();
  if (auth) return auth.subject_id;
  const subjectId = storage.getStore()?.subjectId;
  if (subjectId != null && subjectId > 0) return subjectId;
  return getResolvedWorldContext().agent_subject_id;
}

export function getToolRegistry(): ToolSetRegistry {
  const tools = storage.getStore()?.tools;
  if (!tools) {
    throw new Error("ToolSetRegistry not set in tool context; pass tools via runWithToolContext");
  }
  return tools;
}

/** tools_load appends executable tool names in the same turn (conversation only) */
export function grantExecutableTools(names: readonly string[]): void {
  const store = storage.getStore();
  if (!store?.executableTools) return;
  // AutoLlm / 策略物化 runs：冻结 executableTools，禁止 toolset_load 扩权
  if (store.contextKind === "auto_llm") return;
  for (const name of names) {
    if (name.trim()) store.executableTools.add(name.trim());
  }
}

/** Whether name is in execution allowlist; undefined when no allowlist (no gate) */
export function isExecutableTool(name: string): boolean | undefined {
  const set = storage.getStore()?.executableTools;
  if (!set) return undefined;
  return set.has(name);
}
