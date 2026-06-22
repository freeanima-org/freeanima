import { describe, expect, it } from "bun:test";
import {
  BackendRegistry,
  LlmProfile,
  LlmProvider,
  PROFILE_CHAT,
  ProfileRegistry,
  ProviderError,
  ProviderRegistry,
  assertProfilesValid,
  collectProviderIds,
  hop,
  profileDef,
  validateProfiles,
} from "./index.ts";
import { MockBackend } from "./test-helpers/mock-backend.ts";

function setupProfileStack(backend = new MockBackend()) {
  const backends = new BackendRegistry();
  backends.register(backend);
  const providers = new ProviderRegistry(backends);
  providers.register(new LlmProvider("main", backend.id, { apiKey: "k" }, backend));
  const defs = [
    profileDef("chat", [hop("main", "cfg-model", { temperature: 0.2 })], { topP: 0.9 }),
    profileDef("reflect", [hop("main", "reflect-model")]),
  ];
  const profiles = new ProfileRegistry(defs, PROFILE_CHAT, providers);
  return { backend, providers, profiles, profile: profiles.resolve("chat") };
}

describe("profile helpers", () => {
  it("collectProviderIds deduplicates hops", () => {
    const ids = collectProviderIds([
      profileDef("a", [hop("p1", "m1"), hop("p2", "m2")]),
      profileDef("b", [hop("p1", "m3")]),
    ]);
    expect(ids.toSorted()).toEqual(["p1", "p2"]);
  });

  it("validateProfiles reports structural issues", () => {
    const backends = new BackendRegistry();
    backends.register(new MockBackend());
    const providers = new ProviderRegistry(backends);
    const result = validateProfiles(
      [
        { id: "empty", chain: [] },
        { id: "bad-hop", chain: [{ provider: "", model: "" }] },
        { id: "missing-prov", chain: [{ provider: "ghost", model: "m" }] },
      ],
      providers,
    );
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.message)).toEqual([
      "chain cannot be empty",
      "hop.provider cannot be empty",
      "hop.model cannot be empty",
      'provider "ghost" is not registered',
    ]);
  });

  it("assertProfilesValid throws aggregated detail", () => {
    const backends = new BackendRegistry();
    backends.register(new MockBackend());
    const providers = new ProviderRegistry(backends);
    expect(() => assertProfilesValid([{ id: "x", chain: [] }], providers)).toThrow(
      "Invalid profile config: x[-1]: chain cannot be empty",
    );
  });
});

describe("ProfileRegistry", () => {
  it("resolve uses default profile when id omitted", () => {
    const { profiles } = setupProfileStack();
    expect(profiles.resolve().id).toBe("chat");
    expect(profiles.default.id).toBe("chat");
  });

  it("rejects duplicate profile ids and missing default", () => {
    const backends = new BackendRegistry();
    backends.register(new MockBackend());
    const providers = new ProviderRegistry(backends);
    providers.register(new LlmProvider("main", "mock", {}, backends.get("mock")));

    expect(
      () =>
        new ProfileRegistry(
          [profileDef("chat", [hop("main", "m")]), profileDef("chat", [hop("main", "m")])],
          "chat",
          providers,
        ),
    ).toThrow("Duplicate profile id: chat");

    expect(
      () => new ProfileRegistry([profileDef("chat", [hop("main", "m")])], "missing", providers),
    ).toThrow('default profile "missing" is not defined');
  });

  it("falls back to default profile when resolving unknown profile", () => {
    const { profiles } = setupProfileStack();
    expect(profiles.resolve("nope").id).toBe("chat");
    expect(profiles.resolve("summary").id).toBe("chat");
  });

  it("list returns all registered profiles", () => {
    const { profiles } = setupProfileStack();
    expect(
      profiles
        .list()
        .map((p) => p.id)
        .toSorted(),
    ).toEqual(["chat", "reflect"]);
  });
});

describe("LlmProfile", () => {
  it("bind merges params and supports model override", async () => {
    const { profile } = setupProfileStack();
    await profile.bind({ model: "session-model", requestParams: { temperature: 0.7 } });
    expect(profile.model).toBe("session-model");
    expect(profile.params.temperature).toBe(0.7);
    expect(profile.params.topP).toBe(0.9);
  });

  it("provider getter throws before bind", () => {
    const { providers } = setupProfileStack();
    const unbound = new LlmProfile(profileDef("solo", [hop("main", "m")]), providers);
    expect(() => unbound.provider).toThrow('profile "solo" is not bound yet');
  });

  it("chat delegates to backend and marks provider healthy", async () => {
    const backend = new MockBackend({ chatResult: { content: "hello", model: "test-model" } });
    const { profile, providers } = setupProfileStack(backend);
    const out = await profile.chat([{ role: "user", content: "hi" }], {
      systemPrompt: "sys",
      model: "override-model",
    });
    expect(out.content).toBe("hello");
    expect(backend.chatCalls).toHaveLength(1);
    expect(backend.chatCalls[0]?.model).toBe("override-model");
    expect(backend.chatCalls[0]?.request.systemPrompt).toBe("sys");
    expect(providers.get("main").getHealth().healthy).toBe(true);
  });

  it("chat maps failure via reportFailure", async () => {
    const backend = new MockBackend({ chatError: new Error("upstream") });
    const { profile, providers } = setupProfileStack(backend);
    await expect(profile.chat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(providers.get("main").getHealth().healthy).toBe(false);
  });

  it("chatStream yields backend events and marks healthy on completion", async () => {
    const backend = new MockBackend({
      streamEvents: [
        { type: "content", content: "a" },
        {
          type: "tool_calls",
          tool_calls: [{ id: "c1", function: { name: "t", arguments: "{}" } }],
        },
        { type: "done", model: "test-model", finish_reason: "tool_calls" },
      ],
    });
    const { profile, providers } = setupProfileStack(backend);
    const events = [];
    for await (const ev of profile.chatStream([{ role: "user", content: "hi" }])) {
      events.push(ev);
    }
    expect(events).toHaveLength(3);
    expect(providers.get("main").getHealth().healthy).toBe(true);
  });

  it("chatStream failure marks provider unhealthy", async () => {
    const backend = new MockBackend({ streamError: new ProviderError("x", "timeout", true) });
    const { profile, providers } = setupProfileStack(backend);
    await expect(async () => {
      for await (const _ of profile.chatStream([{ role: "user", content: "hi" }])) {
        /* drain */
      }
    }).toThrow(ProviderError);
    expect(providers.get("main").getHealth().healthy).toBe(false);
  });

  it("bind throws on empty chain", async () => {
    const backends = new BackendRegistry();
    backends.register(new MockBackend());
    const providers = new ProviderRegistry(backends);
    providers.register(new LlmProvider("main", "mock", {}, backends.get("mock")));
    const profile = new LlmProfile({ id: "empty", chain: [] }, providers);
    await expect(profile.bind()).rejects.toThrow('profile "empty" chain cannot be empty');
  });
});
