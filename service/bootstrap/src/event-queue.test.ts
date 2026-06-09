import { describe, expect, it, afterEach } from "bun:test";
import { RedisClient } from "bun";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import { RedisEventQueue } from "@freeanima/connectors-eventbus-redis";
import { resetConfigForTest, setConfigForTest } from "@freeanima/service-config";
import {
  createEventQueue,
  resetEventQueueOverridesForTest,
  setEventQueueOverridesForTest,
} from "./event-queue.ts";

const minimalLlm = {
  default_profile: "chat",
  providers: {
    main: {
      backend: "openai_compatible" as const,
      base_url: "https://api.openai.com/v1",
      api_key: "sk-test",
    },
  },
  profiles: {
    chat: { chain: [{ provider: "main", model: "gpt-4" }] },
  },
};

describe("createEventQueue", () => {
  afterEach(() => {
    resetConfigForTest();
    resetEventQueueOverridesForTest();
  });

  it("默认返回 SqliteEventQueue", () => {
    setConfigForTest({ llm: minimalLlm });
    setEventQueueOverridesForTest({ sqliteDbPath: ":memory:" });
    expect(createEventQueue()).toBeInstanceOf(SqliteEventQueue);
  });

  it("eventbus.backend=redis 时返回 RedisEventQueue", () => {
    const mockRedis = {
      close: () => {},
    } as unknown as RedisClient;
    setConfigForTest({
      llm: minimalLlm,
      eventbus: { backend: "redis", key_prefix: "test:events" },
      redis: { url: "redis://127.0.0.1:6379/0" },
    });
    setEventQueueOverridesForTest({ redisClient: mockRedis });
    expect(createEventQueue()).toBeInstanceOf(RedisEventQueue);
  });
});
