import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileConfig, stringifyYaml } from "./index.ts";
import { getEventbusBackend, getEventbusKeyPrefix } from "./eventbus.ts";
import { eventbusConfigSchema } from "@freeanima/core/config";

describe("eventbus config", () => {
  let home: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-eventbus-cfg-"));
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("eventbusConfigSchema accepts redis only", () => {
    expect(eventbusConfigSchema.safeParse({ backend: "redis" }).success).toBe(true);
    expect(eventbusConfigSchema.safeParse({ backend: "sqlite" }).success).toBe(false);
    expect(eventbusConfigSchema.safeParse({ backend: "kafka" }).success).toBe(false);
  });

  it("default backend is redis", () => {
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
    const config = FileConfig.open();
    expect(getEventbusBackend(config.data)).toBe("redis");
    expect(getEventbusKeyPrefix(config.data)).toBe("anima:events");
  });

  it("reads eventbus.backend and key_prefix", () => {
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
    const config = FileConfig.open();
    expect(getEventbusBackend(config.data)).toBe("redis");
    expect(getEventbusKeyPrefix(config.data)).toBe("custom:events");
    expect(config.data.eventbus?.backend).toBe("redis");
  });
});
