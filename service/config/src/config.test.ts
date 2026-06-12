import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/storage-config";
import { parseYaml } from "./yaml.ts";
import { animaConfigSchema } from "./schemas/config.ts";
import { expandConfigEnv } from "./env-expand.ts";
import { getProfileHopModel } from "./llm-config.ts";
import { MINIMAL_LLM_YAML } from "./test-helpers/minimal-llm-config.ts";

function parseMinimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("service-config", () => {
  it("loads llm profiles and resolves default model", () => {
    const config = Config.fromSnapshot(parseMinimalConfig());
    expect(getProfileHopModel(config.data, "chat")).toBe("test-model");
    expect(config.data.llm.default_profile).toBe("chat");
  });

  it("loads firecrawl with llm block", () => {
    const config = Config.fromSnapshot({
      ...parseMinimalConfig(),
      firecrawl: { api_url: "http://127.0.0.1:3002" },
    });
    expect(config.data.firecrawl?.api_url).toBe("http://127.0.0.1:3002");
  });

  it("expands ${VAR} in config values via expandConfigEnv", () => {
    process.env.TEST_LLM_MODEL = "env-model";
    const expanded = expandConfigEnv(MINIMAL_LLM_YAML.replace("test-model", "${TEST_LLM_MODEL}"));
    const parsed = animaConfigSchema.safeParse(parseYaml(expanded));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const config = Config.fromSnapshot(parsed.data);
      expect(getProfileHopModel(config.data, "chat")).toBe("env-model");
    }
    delete process.env.TEST_LLM_MODEL;
  });
});
