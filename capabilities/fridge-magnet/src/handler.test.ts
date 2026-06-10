import { afterEach, describe, expect, it } from "bun:test";
import type { FridgeStorePort } from "./fridge-store-port.ts";
import { registerFridgeStore, resetFridgeStoreForTests } from "./fridge-store-port.ts";
import { createFridgeMagnetHandler } from "./handler.ts";
import { magnetRedisKey } from "./store.ts";

function createMemoryFridgeStore(entries: Record<string, string>): FridgeStorePort {
  const store = new Map(Object.entries(entries));
  return {
    set: async (key, value) => {
      store.set(key, value);
    },
    get: async (key) => store.get(key) ?? null,
    delete: async (key) => {
      store.delete(key);
    },
    scan: async (pattern) => {
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      return [...store.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value }));
    },
  };
}

describe("createFridgeMagnetHandler", () => {
  afterEach(() => {
    resetFridgeStoreForTests();
  });

  it("global scan injects magnets from multiple sessions", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("session", "sess-a:note1")]: "Note A",
        [magnetRedisKey("session", "sess-b:note2")]: "Note B",
        [magnetRedisKey("tasks", "summary")]: "Todos (1)",
      }),
    );

    const messages = [{ role: "user", content: "Hello" }];
    await createFridgeMagnetHandler()({
      sessionId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages[0]!.content).toBe(
      "```fridge\nsession:sess-a:note1: Note A\nsession:sess-b:note2: Note B\ntasks:summary: Todos (1)\n```\nHello",
    );
  });

  it("does not inject when last message is not user", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("tasks", "summary")]: "Todos",
      }),
    );

    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Reply" },
    ];
    await createFridgeMagnetHandler()({
      sessionId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages[0]!.content).toBe("Hello");
  });
});
