import { AsyncLocalStorage } from "node:async_hooks";
import type { PgRepositories } from "@freeanima/engine-repos";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

type ToolContextStore = {
  sessionId: string;
  repos?: PgRepositories;
  tools: ToolSetRegistry;
  /** 可变执行白名单；未设置时不做 loaded 门禁 */
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

/** 每次 next() 在 session 上下文中执行，供 runStream 等 async generator 使用 */
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

export function runWithToolContext<T>(
  sessionId: string,
  fn: () => T,
  opts: {
    tools: ToolSetRegistry;
    repos?: PgRepositories;
    executableTools?: readonly string[];
  },
): T {
  const store: ToolContextStore = {
    sessionId,
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

export function getToolSessionId(): string | undefined {
  return storage.getStore()?.sessionId;
}

export function getToolRepos(): PgRepositories | undefined {
  return storage.getStore()?.repos;
}

export function getToolRegistry(): ToolSetRegistry {
  const tools = storage.getStore()?.tools;
  if (!tools) {
    throw new Error(
      "ToolSetRegistry 未在 tool context 中设置；请通过 runWithToolContext 传入 tools",
    );
  }
  return tools;
}

/** tools_load 等同轮追加可执行工具名 */
export function grantExecutableTools(names: readonly string[]): void {
  const store = storage.getStore();
  if (!store?.executableTools) return;
  for (const name of names) {
    if (name.trim()) store.executableTools.add(name.trim());
  }
}

/** 返回是否在执行白名单内；无白名单时 undefined（不门禁） */
export function isExecutableTool(name: string): boolean | undefined {
  const set = storage.getStore()?.executableTools;
  if (!set) return undefined;
  return set.has(name);
}
