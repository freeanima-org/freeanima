import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  clearPersistedActiveStream,
  readPersistedActiveStream,
  writePersistedActiveStream,
} from "./active-stream-persist.ts";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
});

afterEach(() => {
  store.clear();
});

describe("active-stream-persist", () => {
  it("writes and reads by conversation", () => {
    writePersistedActiveStream("c1", "s1");
    expect(readPersistedActiveStream("c1")).toEqual({
      conversationId: "c1",
      streamId: "s1",
    });
    expect(readPersistedActiveStream("other")).toBeNull();
  });

  it("clears only matching conversation", () => {
    writePersistedActiveStream("c1", "s1");
    clearPersistedActiveStream("other");
    expect(readPersistedActiveStream("c1")?.streamId).toBe("s1");
    clearPersistedActiveStream("c1");
    expect(readPersistedActiveStream()).toBeNull();
  });
});
