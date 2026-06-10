import { afterEach, describe, expect, it } from "bun:test";
import type { FridgeStorePort } from "@freeanima/capabilities-fridge-magnet/fridge-store-port";
import {
  registerFridgeStore,
  resetFridgeStoreForTests,
} from "@freeanima/capabilities-fridge-magnet";
import { magnetRedisKey } from "@freeanima/capabilities-fridge-magnet";
import { initRedis, setRedisForTest, resetRedisForTest } from "@freeanima/connectors-redis";
import { listFridgeMagnets } from "./service-fridge.ts";

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

describe("listFridgeMagnets", () => {
  afterEach(() => {
    resetFridgeStoreForTests();
    resetRedisForTest();
  });

  it("返回全局便签、inject_text 与 TTL", async () => {
    const keyA = magnetRedisKey("session", "sess-1:note");
    const keyTasks = magnetRedisKey("tasks", "summary");
    registerFridgeStore(
      createMemoryFridgeStore({
        [keyA]: "便签内容",
        [keyTasks]: "待办 (2)",
      }),
    );

    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest({
      ttl: async (key: string) => {
        if (key === keyA) return 3600;
        if (key === keyTasks) return -1;
        return -2;
      },
    } as never);

    const result = await listFridgeMagnets();
    expect(result.redis_configured).toBe(true);
    expect(result.magnets).toHaveLength(2);
    expect(result.magnets[0]).toMatchObject({
      key: "session:sess-1:note",
      value: "便签内容",
      module: "session",
      session_id: "sess-1",
      label: "note",
      ttl_seconds: 3600,
    });
    expect(result.magnets[1]).toMatchObject({
      key: "tasks:summary",
      module: "tasks",
      ttl_seconds: -1,
    });
    expect(result.inject_text).toBe(
      "```fridge\nsession:sess-1:note: 便签内容\ntasks:summary: 待办 (2)\n```\n",
    );
  });

  it("Redis 未配置时返回空列表", async () => {
    resetRedisForTest();
    const result = await listFridgeMagnets();
    expect(result.redis_configured).toBe(false);
    expect(result.magnets).toEqual([]);
    expect(result.inject_text).toBe("```fridge\n\n```\n");
  });
});
