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
import { ToolRegistry } from "@freeanima/engine-tool";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { MockBackend } from "@freeanima/engine-provider-llm/test-helpers/mock-backend";
import { Engine } from "./engine.ts";

describe("Engine", () => {
  it("组合 tools 与 llm 组件群", () => {
    const tools = new ToolRegistry();
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
    const engine = new Engine(tools, llm, nullPgRepositories);
    expect(engine.tools).toBe(tools);
    expect(engine.llm.backends).toBe(backends);
    expect(engine.llm.providers).toBe(providers);
    expect(engine.llm.profiles).toBe(profiles);
  });
});
