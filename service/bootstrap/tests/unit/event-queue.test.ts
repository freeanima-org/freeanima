import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import { RedisEventQueue } from "@freeanima/connectors-eventbus-redis";
import { clearConfigCache, stringifyYaml } from "@freeanima/service-config";
import { createEventQueue } from "../../src/event-queue.ts";

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
  let home: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-bootstrap-eq-"));
    process.env.FREEANIMA_HOME = home;
    clearConfigCache();
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    clearConfigCache();
  });

  it("默认返回 SqliteEventQueue", () => {
    writeFileSync(join(home, "config.yaml"), stringifyYaml({ llm: minimalLlm }));
    clearConfigCache();
    expect(createEventQueue()).toBeInstanceOf(SqliteEventQueue);
  });

  it("eventbus.backend=redis 时返回 RedisEventQueue", () => {
    writeFileSync(
      join(home, "config.yaml"),
      stringifyYaml({
        llm: minimalLlm,
        eventbus: { backend: "redis", key_prefix: "test:events" },
      }),
    );
    clearConfigCache();
    expect(createEventQueue()).toBeInstanceOf(RedisEventQueue);
  });
});
