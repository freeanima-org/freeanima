import { describe, expect, it, afterEach } from "bun:test";
import { RedisClient } from "bun";
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

  it("returns RedisEventQueue by default", () => {
    const mockRedis = {
      close: () => {},
    } as unknown as RedisClient;
    setConfigForTest({ llm: minimalLlm });
    setEventQueueOverridesForTest({ redisClient: mockRedis });
    expect(createEventQueue()).toBeInstanceOf(RedisEventQueue);
  });
});
