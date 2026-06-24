import { AsyncLocalStorage } from "node:async_hooks";
import type { PgRepositories } from "@freeanima/core/repos";
import type { ToolSetRegistry } from "./toolset.ts";

export type ToolContextKind = "session" | "auto_llm";

type ToolContextStore = {
  contextId: string;
  contextKind: ToolContextKind;
  parentConversationId?: string;
  repos?: PgRepositories;
  tools: ToolSetRegistry;
  /** Mutable execution allowlist; no loaded gate when unset */
  executableTools?: Set<string>;
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

/** Each next() runs in session context; for runStream and other async generators */
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
  repos?: PgRepositories;
  executableTools?: readonly string[];
  contextKind?: ToolContextKind;
  parentConversationId?: string;
};

export function runWithToolContext<T>(
  contextId: string,
  fn: () => T,
  opts: RunWithToolContextOpts,
): T {
  const store: ToolContextStore = {
    contextId,
    contextKind: opts.contextKind ?? "session",
    parentConversationId: opts.parentConversationId,
    repos: opts.repos,
    tools: opts.tools,
    executableTools: opts.executableTools ? new Set(opts.executableTools) : undefined,
  };
  const result = storage.run(store, fn);
  if (isAsyncIterable(result)) {
    return bindToolContext(store, result) as T;
  }
  return result;
}

export function getToolContextKind(): ToolContextKind | undefined {
  return storage.getStore()?.contextKind;
}

/** Session id for memory attribution; undefined in auto_llm context */
export function getToolSessionId(): string | undefined {
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

export function getToolRepos(): PgRepositories | undefined {
  return storage.getStore()?.repos;
}

export function getToolRegistry(): ToolSetRegistry {
  const tools = storage.getStore()?.tools;
  if (!tools) {
    throw new Error("ToolSetRegistry not set in tool context; pass tools via runWithToolContext");
  }
  return tools;
}

/** tools_load appends executable tool names in the same turn */
export function grantExecutableTools(names: readonly string[]): void {
  const store = storage.getStore();
  if (!store?.executableTools) return;
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
