import { AsyncLocalStorage } from "node:async_hooks";

type ToolContextStore = { sessionId: string };

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
async function* bindToolContext<T>(sessionId: string, source: AsyncIterable<T>): AsyncGenerator<T> {
  const it = source[Symbol.asyncIterator]();
  while (true) {
    const step = await storage.run({ sessionId }, () => it.next());
    if (step.done) return;
    yield step.value;
  }
}

export function runWithToolContext<T>(sessionId: string, fn: () => T): T {
  const result = storage.run({ sessionId }, fn);
  if (isAsyncIterable(result)) {
    return bindToolContext(sessionId, result) as T;
  }
  return result;
}

export function getToolSessionId(): string | undefined {
  return storage.getStore()?.sessionId;
}
