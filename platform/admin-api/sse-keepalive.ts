export const SSE_KEEPALIVE_INTERVAL_MS = 15_000;

function sleep(ms: number): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  }).then(() => null);
}

export type SseKeepaliveOptions = {
  intervalMs?: number;
};

/** 在 source 长时间无产出时注入 keepalive 事件，避免 HTTP chunked 连接 idle 被断开 */
export async function* withSseKeepalive<T>(
  source: AsyncIterable<T>,
  keepalive: () => T,
  signal?: AbortSignal,
  options?: SseKeepaliveOptions,
): AsyncGenerator<T> {
  const intervalMs = options?.intervalMs ?? SSE_KEEPALIVE_INTERVAL_MS;
  const iter = source[Symbol.asyncIterator]();
  let pendingNext: Promise<IteratorResult<T>> | null = null;

  try {
    while (true) {
      if (signal?.aborted) break;
      pendingNext ??= iter.next();
      const raced = await Promise.race([pendingNext, sleep(intervalMs)]);
      if (raced == null) {
        yield keepalive();
        continue;
      }
      pendingNext = null;
      if (raced.done) break;
      yield raced.value;
    }
  } finally {
    await iter.return?.();
  }
}
