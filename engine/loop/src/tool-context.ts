import { AsyncLocalStorage } from "node:async_hooks";
import type { PgRepositories } from "@freeanima/engine-repos";

type ToolContextStore = { sessionId: string; repos?: PgRepositories };

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
  opts?: { repos?: PgRepositories },
): T {
  const store: ToolContextStore = { sessionId, repos: opts?.repos };
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
