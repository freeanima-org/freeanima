const DEFAULT_PREFIX = "anima:events";

/** Unit test poll assertion */
export async function waitFor(predicate: () => boolean, timeoutMs = 400): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

type MockLists = {
  pending: string[];
  processing: string[];
  id: number;
};

/** For tests: in-memory Redis list mock */
export function createMockRedisLists(prefix = DEFAULT_PREFIX): {
  lists: MockLists;
  client: {
    incr: (key: string) => Promise<number>;
    lpush: (key: string, value: string) => Promise<number>;
    lrange: (key: string, start: number, stop: number) => Promise<string[]>;
    lrem: (key: string, count: number, value: string) => Promise<number>;
    del: (key: string) => Promise<number>;
    brpoplpush: (source: string, dest: string, timeoutSec: number) => Promise<string | null>;
    close: () => void;
  };
  keys: { pending: string; processing: string; id: string };
} {
  const keys = {
    pending: `${prefix}:pending`,
    processing: `${prefix}:processing`,
    id: `${prefix}:id`,
  };
  const lists: MockLists = { pending: [], processing: [], id: 0 };

  const listFor = (key: string): string[] | null => {
    if (key === keys.pending) return lists.pending;
    if (key === keys.processing) return lists.processing;
    return null;
  };

  const client = {
    incr: async (key: string): Promise<number> => {
      if (key !== keys.id) throw new Error(`unexpected incr key: ${key}`);
      lists.id += 1;
      return lists.id;
    },
    lpush: async (key: string, value: string): Promise<number> => {
      const list = listFor(key);
      if (!list) throw new Error(`unexpected lpush key: ${key}`);
      list.unshift(value);
      return list.length;
    },
    lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
      const list = listFor(key);
      if (!list) return [];
      const end = stop < 0 ? list.length : stop + 1;
      return list.slice(start, end);
    },
    lrem: async (key: string, count: number, value: string): Promise<number> => {
      const list = listFor(key);
      if (!list) return 0;
      let removed = 0;
      const limit = count === 0 ? Infinity : Math.abs(count);
      if (count >= 0) {
        for (let i = 0; i < list.length && removed < limit; ) {
          if (list[i] === value) {
            list.splice(i, 1);
            removed++;
          } else {
            i++;
          }
        }
      }
      return removed;
    },
    del: async (key: string): Promise<number> => {
      const list = listFor(key);
      if (!list) return 0;
      const had = list.length > 0 ? 1 : 0;
      list.length = 0;
      return had;
    },
    brpoplpush: async (
      source: string,
      dest: string,
      _timeoutSec: number,
    ): Promise<string | null> => {
      const src = listFor(source);
      const dst = listFor(dest);
      if (!src || !dst) return null;
      if (src.length === 0) return null;
      const value = src.pop();
      if (value == null) return null;
      dst.unshift(value);
      return value;
    },
    close: (): void => {},
  };

  return { lists, client, keys };
}

/** For tests: write one event to pending queue */
export function seedPendingEvent(
  lists: MockLists,
  topic: string,
  payload: Record<string, unknown>,
  opts?: { id?: number; retries?: number },
): void {
  lists.id = Math.max(lists.id, opts?.id ?? lists.id + 1);
  const envelope = {
    id: opts?.id ?? lists.id,
    topicQualifiedId: topic,
    payload,
    retries: opts?.retries ?? 0,
    createdAt: new Date().toISOString(),
  };
  lists.pending.unshift(JSON.stringify(envelope));
}

/** For tests: write one event to processing queue (simulate stuck) */
export function seedProcessingEvent(
  lists: MockLists,
  topic: string,
  payload: Record<string, unknown>,
  opts?: { id?: number; retries?: number },
): void {
  lists.id = Math.max(lists.id, opts?.id ?? lists.id + 1);
  const envelope = {
    id: opts?.id ?? lists.id,
    topicQualifiedId: topic,
    payload,
    retries: opts?.retries ?? 0,
    createdAt: new Date().toISOString(),
  };
  lists.processing.unshift(JSON.stringify(envelope));
}
