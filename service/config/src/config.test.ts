import { describe, it, expect, afterEach } from "bun:test";
import { parseYaml } from "./yaml.ts";
import { animaConfigSchema } from "./schemas/config.ts";
import { expandConfigEnv } from "./env-expand.ts";
import { loadConfig, resetConfigForTest, setConfigForTest } from "./config.ts";
import { getProfileHopModel } from "./llm-config.ts";
import { MINIMAL_LLM_YAML } from "./test-helpers/minimal-llm-config.ts";

function parseMinimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("service-config", () => {
  afterEach(() => {
    resetConfigForTest();
  });

  it("loads llm profiles and resolves default model", () => {
    setConfigForTest(parseMinimalConfig());
    const cfg = loadConfig();
    expect(getProfileHopModel(cfg, "chat")).toBe("test-model");
    expect(cfg.llm.default_profile).toBe("chat");
  });

  it("loads firecrawl with llm block", () => {
    setConfigForTest({
      ...parseMinimalConfig(),
      firecrawl: { api_url: "http://127.0.0.1:3002" },
    });
    const cfg = loadConfig();
    expect(cfg.firecrawl?.api_url).toBe("http://127.0.0.1:3002");
  });

  it("expands ${VAR} in config values via expandConfigEnv", () => {
    process.env.TEST_LLM_MODEL = "env-model";
    const expanded = expandConfigEnv(MINIMAL_LLM_YAML.replace("test-model", "${TEST_LLM_MODEL}"));
    const parsed = animaConfigSchema.safeParse(parseYaml(expanded));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      setConfigForTest(parsed.data);
      expect(getProfileHopModel(loadConfig(), "chat")).toBe("env-model");
    }
    delete process.env.TEST_LLM_MODEL;
  });
});
