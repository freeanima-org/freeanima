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

  it("全局 scan 注入多 session 便签", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("session", "sess-a:note1")]: "便签 A",
        [magnetRedisKey("session", "sess-b:note2")]: "便签 B",
        [magnetRedisKey("tasks", "summary")]: "待办 (1)",
      }),
    );

    const messages = [{ role: "user", content: "你好" }];
    await createFridgeMagnetHandler()({
      sessionId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages[0]!.content).toBe(
      "```fridge\nsession:sess-a:note1: 便签 A\nsession:sess-b:note2: 便签 B\ntasks:summary: 待办 (1)\n```\n你好",
    );
  });

  it("最后一条非 user 消息时不注入", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("tasks", "summary")]: "待办",
      }),
    );

    const messages = [
      { role: "user", content: "你好" },
      { role: "assistant", content: "回复" },
    ];
    await createFridgeMagnetHandler()({
      sessionId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages[0]!.content).toBe("你好");
  });
});
