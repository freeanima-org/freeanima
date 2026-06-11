import { describe, expect, it } from "bun:test";
import {
  BackendRegistry,
  hop,
  LlmProvider,
  PROFILE_CHAT,
  profileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/engine-provider-llm";
import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { MockBackend } from "@freeanima/engine-provider-llm/test-helpers/mock-backend";
import { Config, type AnimaConfig } from "@freeanima/engine-config";
import { createTestLogger } from "@freeanima/kernel-logging/testing";
import { Engine } from "./engine.ts";

const testCfg = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: "test",
      },
    },
    profiles: {
      chat: {
        chain: [{ provider: "main", model: "cfg-model" }],
      },
    },
  },
} as AnimaConfig;

describe("Engine", () => {
  it("composes catalog and llm component group", () => {
    const catalog = {
      toolSets: new ToolSetRegistry(),
      skills: new SkillRegistry(),
    };
    const backend = new MockBackend();
    const backends = new BackendRegistry();
    backends.register(backend);
    const providers = new ProviderRegistry(backends);
    providers.register(new LlmProvider("main", backend.id, { apiKey: "k" }, backend));
    const profiles = new ProfileRegistry(
      [profileDef(PROFILE_CHAT, [hop("main", "cfg-model")])],
      PROFILE_CHAT,
      providers,
    );
    const llm = { backends, providers, profiles };
    const config = Config.fromSnapshot(testCfg);
    const engine = new Engine(catalog, llm, nullPgRepositories, config, createTestLogger());
    expect(engine.toolSets).toBe(catalog.toolSets);
    expect(engine.catalog.skills).toBe(catalog.skills);
    expect(engine.llm.backends).toBe(backends);
    expect(engine.llm.providers).toBe(providers);
    expect(engine.llm.profiles).toBe(profiles);
    expect(engine.config).toBe(config);
    expect(engine.config.data).toBe(testCfg);
  });
});
