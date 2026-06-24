import { afterEach, describe, expect, it } from "bun:test";
import type { FridgeStorePort } from "@freeanima/capabilities-tasks/fridge-magnet/fridge-store-port";
import {
  formatFridgeMagnetManifestPreview,
  magnetRedisKey,
  registerFridgeStore,
  resetFridgeStoreForTests,
} from "@freeanima/capabilities-tasks/fridge-magnet";
import {
  initRedis,
  setRedisForTest,
  resetRedisForTest,
} from "@freeanima/platform/connectors/redis";
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

  it("returns global notes, inject_text, and TTL", async () => {
    const keyA = magnetRedisKey("conversation", "sess-1:note");
    const keyTasks = magnetRedisKey("tasks", "summary");
    registerFridgeStore(
      createMemoryFridgeStore({
        [keyA]: "note content",
        [keyTasks]: "tasks (2)",
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
      key: "conversation:sess-1:note",
      value: "note content",
      module: "conversation",
      conversation_id: "sess-1",
      label: "note",
      ttl_seconds: 3600,
    });
    expect(result.magnets[1]).toMatchObject({
      key: "tasks:summary",
      module: "tasks",
      ttl_seconds: -1,
    });
    expect(result.inject_text).toBe(
      formatFridgeMagnetManifestPreview([
        { key: "conversation:sess-1:note", value: "note content" },
        { key: "tasks:summary", value: "tasks (2)" },
      ]),
    );
  });

  it("returns empty list when Redis not configured", async () => {
    resetRedisForTest();
    const result = await listFridgeMagnets();
    expect(result.redis_configured).toBe(false);
    expect(result.magnets).toEqual([]);
    expect(result.inject_text).toBe("");
  });
});
