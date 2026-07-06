import { describe, expect, it, afterEach } from "bun:test";
import { RedisClient } from "bun";
import { RedisEventQueue } from "@freeanima/platform/connectors/eventbus-redis";
import { Config } from "@freeanima/platform/config";
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
    resetEventQueueOverridesForTest();
  });

  it("returns RedisEventQueue by default", () => {
    const mockRedis = {
      close: () => {},
    } as unknown as RedisClient;
    const config = Config.fromSnapshot({ llm: minimalLlm });
    setEventQueueOverridesForTest({ redisClient: mockRedis });
    expect(createEventQueue(config)).toBeInstanceOf(RedisEventQueue);
  });
});
