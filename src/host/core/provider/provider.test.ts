import { describe, expect, it } from "bun:test";
import { BackendRegistry, LlmProvider, ProviderError, ProviderRegistry } from "./index.ts";
import { MockBackend } from "./test-helpers/mock-backend.ts";

function setupProvider(backend = new MockBackend()) {
  const backends = new BackendRegistry();
  backends.register(backend);
  const providers = new ProviderRegistry(backends);
  const provider = new LlmProvider("main", backend.id, { apiKey: "k" }, backend);
  providers.register(provider);
  return { backend, providers, provider };
}

describe("LlmProvider", () => {
  it("prepareParams merges layers and clamps to catalog", async () => {
    const backend = new MockBackend({
      modelInfo: {
        model: "m",
        contextWindow: 1,
        maxOutputTokens: 100,
        supportedParams: ["temperature", "maxOutputTokens"],
      },
    });
    const { provider } = setupProvider(backend);
    const params = await provider.prepareParams(
      "m",
      { temperature: 0.3 },
      { maxOutputTokens: 999 },
    );
    expect(params).toEqual({ temperature: 0.3, maxOutputTokens: 100 });
  });

  it("prepareParams throws when model cannot be resolved", async () => {
    const { provider } = setupProvider();
    await expect(provider.prepareParams("__missing__")).rejects.toThrow(
      'provider "main" cannot resolve model "__missing__"',
    );
  });

  it("markHealthy and reportFailure update health", () => {
    const { provider } = setupProvider();
    provider.reportFailure(new Error("fail"));
    expect(provider.getHealth().healthy).toBe(false);
    expect(provider.getHealth().lastError?.message).toBe("Error: fail");

    provider.markHealthy();
    expect(provider.getHealth().healthy).toBe(true);
  });

  it("reportFailure preserves existing ProviderError without remapping", () => {
    const { provider } = setupProvider();
    const original = new ProviderError("rate", "rate_limited", true, { providerId: "main" });
    const out = provider.reportFailure(original);
    expect(out).toBe(original);
    expect(provider.getHealth().lastError).toBe(original);
  });

  it("mapError delegates to backend with providerId", () => {
    const { provider } = setupProvider();
    const err = provider.mapError(new Error("x"));
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.providerId).toBe("main");
  });
});

describe("ProviderRegistry", () => {
  it("lazy-instantiates from registerSpec", () => {
    const backend = new MockBackend();
    const backends = new BackendRegistry();
    backends.register(backend);
    const providers = new ProviderRegistry(backends);
    providers.registerSpec({ id: "lazy", backendId: backend.id, context: { apiKey: "k" } });
    expect(providers.has("lazy")).toBe(true);
    const p = providers.get("lazy");
    expect(p.id).toBe("lazy");
    expect(p.backend).toBe(backend);
    expect(providers.get("lazy")).toBe(p);
  });

  it("rejects conflicting register/registerSpec", () => {
    const backend = new MockBackend();
    const backends = new BackendRegistry();
    backends.register(backend);
    const providers = new ProviderRegistry(backends);
    providers.registerSpec({ id: "x", backendId: backend.id, context: {} });
    expect(() => providers.register(new LlmProvider("x", backend.id, {}, backend))).toThrow(
      'provider "x" already has a pending spec; cannot register again',
    );

    providers.register(new LlmProvider("y", backend.id, {}, backend));
    expect(() => providers.registerSpec({ id: "y", backendId: backend.id, context: {} })).toThrow(
      'provider "y" already instantiated; cannot registerSpec again',
    );
  });

  it("throws when provider id missing", () => {
    const backends = new BackendRegistry();
    backends.register(new MockBackend());
    const providers = new ProviderRegistry(backends);
    expect(() => providers.get("nope")).toThrow("Provider not found: nope");
  });
});
