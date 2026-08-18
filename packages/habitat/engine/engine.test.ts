import { describe, expect, it } from "bun:test";
import {
  BackendRegistry,
  hop,
  LlmProvider,
  PROFILE_CHAT,
  profileDef,
  ProfileRegistry,
  ProviderRegistry,
} from "@freeanima/habitat/core/provider";
import { SkillRegistry } from "@freeanima/habitat/core/skill";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { MockBackend } from "@freeanima/habitat/core/provider/test-helpers/mock-backend";
import { Config, type RuntimeConfig } from "@freeanima/habitat/core/config";
import { createTestLogger } from "@freeanima/habitat/kernel/logging/testing";
import { Engine } from "./engine.ts";

const testCfg = {
  connections: {
    main: {
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
      base_url: "https://api.openai.com/v1",
      api_key: "test",
    },
  },
  text_generate: {
    main: { connection: "main", model: "cfg-model" },
  },
} as RuntimeConfig;

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
    providers.register(new LlmProvider("main", backend.id, { apiKey: "k" }, backends));
    const profiles = new ProfileRegistry(
      [profileDef(PROFILE_CHAT, [hop("main", "cfg-model")])],
      PROFILE_CHAT,
      providers,
    );
    const llm = {
      backends,
      providers,
      profiles,
      resolveProfileId: (id?: string) => id ?? PROFILE_CHAT,
    };
    const config = Config.fromSnapshot(testCfg);
    const engine = new Engine(catalog, llm, config, createTestLogger());
    expect(engine.toolSets).toBe(catalog.toolSets);
    expect(engine.catalog.skills).toBe(catalog.skills);
    expect(engine.llm.backends).toBe(backends);
    expect(engine.llm.providers).toBe(providers);
    expect(engine.llm.profiles).toBe(profiles);
    expect(engine.config).toBe(config);
    expect(engine.config.data).toBe(testCfg);
  });
});
