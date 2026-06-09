import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clearConfigCache, loadConfig, stringifyYaml } from "../../src/index.ts";
import { getEventbusBackend, getEventbusKeyPrefix } from "../../src/eventbus.ts";
import { eventbusConfigSchema } from "../../src/schemas/config.ts";

describe("eventbus config", () => {
  let home: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-eventbus-cfg-"));
    process.env.FREEANIMA_HOME = home;
    clearConfigCache();
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    clearConfigCache();
  });

  it("eventbusConfigSchema 接受 sqlite / redis", () => {
    expect(eventbusConfigSchema.safeParse({ backend: "sqlite" }).success).toBe(true);
    expect(eventbusConfigSchema.safeParse({ backend: "redis" }).success).toBe(true);
    expect(eventbusConfigSchema.safeParse({ backend: "kafka" }).success).toBe(false);
  });

  it("缺省 backend 为 sqlite", () => {
    writeFileSync(
      join(home, "config.yaml"),
      stringifyYaml({
        llm: {
          default_profile: "chat",
          providers: {
            main: {
              backend: "openai_compatible",
              base_url: "https://api.openai.com/v1",
              api_key: "sk-test",
            },
          },
          profiles: {
            chat: { chain: [{ provider: "main", model: "gpt-4" }] },
          },
        },
      }),
    );
    clearConfigCache();
    expect(getEventbusBackend()).toBe("sqlite");
    expect(getEventbusKeyPrefix()).toBe("anima:events");
  });

  it("读取 eventbus.backend 与 key_prefix", () => {
    writeFileSync(
      join(home, "config.yaml"),
      stringifyYaml({
        llm: {
          default_profile: "chat",
          providers: {
            main: {
              backend: "openai_compatible",
              base_url: "https://api.openai.com/v1",
              api_key: "sk-test",
            },
          },
          profiles: {
            chat: { chain: [{ provider: "main", model: "gpt-4" }] },
          },
        },
        eventbus: { backend: "redis", key_prefix: "custom:events" },
      }),
    );
    clearConfigCache();
    expect(getEventbusBackend()).toBe("redis");
    expect(getEventbusKeyPrefix()).toBe("custom:events");
    expect(loadConfig().eventbus?.backend).toBe("redis");
  });
});
