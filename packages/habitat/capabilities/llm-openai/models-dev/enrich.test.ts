import { describe, expect, it, beforeEach } from "bun:test";
import type { Model } from "@opencode-ai/models";
import { providers as snapshotProviders } from "@opencode-ai/models/snapshot";
import {
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
} from "@freeanima/habitat/core/config/schemas/llm-config";
import { omitUndefined } from "@freeanima/habitat/core/util";

import {
  CATALOG_DEFAULT_CONTEXT_WINDOW,
  CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
  mergeModelInfoWithModelsDev,
} from "./enrich.ts";
import {
  lookupModelsDevModel,
  modelsDevProviderIdForPreset,
  PRESET_TO_MODELS_DEV_PROVIDER,
} from "./lookup.ts";
import { clearModelsDevMemoryCache } from "./client.ts";

function stubModel(partial: Partial<Model> & Pick<Model, "id" | "name">): Model {
  return omitUndefined({
    id: partial.id,
    name: partial.name,
    description: partial.description ?? "",
    attachment: partial.attachment ?? false,
    reasoning: partial.reasoning ?? false,
    tool_call: partial.tool_call ?? true,
    temperature: partial.temperature,
    release_date: partial.release_date ?? "2024-01",
    last_updated: partial.last_updated ?? "2024-01",
    modalities: partial.modalities ?? { input: ["text" as const], output: ["text" as const] },
    open_weights: partial.open_weights ?? false,
    limit: partial.limit ?? { context: 64_000, output: 4096 },
    cost: partial.cost,
  });
}

describe("models.dev preset mapping", () => {
  it("maps FreeAnima presets to models.dev provider ids", () => {
    expect(PRESET_TO_MODELS_DEV_PROVIDER[LLM_PRESET_DEEPSEEK]).toBe("deepseek");
    expect(PRESET_TO_MODELS_DEV_PROVIDER[LLM_PRESET_OPENROUTER]).toBe("openrouter");
    expect(PRESET_TO_MODELS_DEV_PROVIDER[LLM_PRESET_OPENCODE_GO]).toBe("opencode-go");
    expect(modelsDevProviderIdForPreset("custom")).toBeNull();
  });
});

describe("lookupModelsDevModel", () => {
  it("finds deepseek-chat under deepseek preset", () => {
    const hit = lookupModelsDevModel(snapshotProviders, "deepseek-chat", LLM_PRESET_DEEPSEEK);
    expect(hit?.id).toBe("deepseek-chat");
    expect(hit?.limit.context).toBeGreaterThan(0);
  });

  it("finds openrouter-style org/model ids", () => {
    const keys = Object.keys(snapshotProviders.openrouter?.models ?? {});
    expect(keys.length).toBeGreaterThan(0);
    const sample = keys[0]!;
    const hit = lookupModelsDevModel(snapshotProviders, sample, LLM_PRESET_OPENROUTER);
    expect(hit?.id).toBe(sample);
  });
});

describe("mergeModelInfoWithModelsDev", () => {
  beforeEach(() => {
    clearModelsDevMemoryCache();
  });

  it("keeps provider non-default context over models.dev", () => {
    const entry = stubModel({
      id: "x",
      name: "X",
      limit: { context: 200_000, output: 16_000 },
      cost: { input: 1, output: 2 },
    });
    const merged = mergeModelInfoWithModelsDev(
      {
        model: "x",
        contextWindow: 99_000,
        maxOutputTokens: 7_000,
        label: "x",
      },
      entry,
    );
    expect(merged.contextWindow).toBe(99_000);
    expect(merged.maxOutputTokens).toBe(7_000);
    expect(merged.cost).toEqual({ input: 1, output: 2 });
    expect(merged.label).toBe("X");
  });

  it("overrides catalog defaults with models.dev limits", () => {
    const entry = stubModel({
      id: "y",
      name: "Y",
      limit: { context: 200_000, output: 16_000 },
    });
    const merged = mergeModelInfoWithModelsDev(
      {
        model: "y",
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
      },
      entry,
    );
    expect(merged.contextWindow).toBe(200_000);
    expect(merged.maxOutputTokens).toBe(16_000);
  });

  it("preferModelsDevLimits forces models.dev limits", () => {
    const entry = stubModel({
      id: "z",
      name: "Z",
      limit: { context: 50_000, output: 2_000 },
    });
    const merged = mergeModelInfoWithModelsDev(
      {
        model: "z",
        contextWindow: 99_000,
        maxOutputTokens: 7_000,
      },
      entry,
      { preferModelsDevLimits: true },
    );
    expect(merged.contextWindow).toBe(50_000);
    expect(merged.maxOutputTokens).toBe(2_000);
  });

  it("narrows supportedParams when temperature/tool_call disabled", () => {
    const entry = stubModel({
      id: "n",
      name: "N",
      temperature: false,
      tool_call: false,
    });
    const merged = mergeModelInfoWithModelsDev(
      {
        model: "n",
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
        supportedParams: ["temperature", "tools", "streaming"],
      },
      entry,
    );
    expect(merged.supportedParams).toBeDefined();
    expect(merged.supportedParams).not.toContain("temperature");
    expect(merged.supportedParams).not.toContain("tools");
  });

  it("maps modalities.input to inputModalities and supportsVision", () => {
    const withImage = mergeModelInfoWithModelsDev(
      {
        model: "vision",
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
      },
      stubModel({
        id: "vision",
        name: "Vision",
        modalities: {
          input: ["text", "image", "audio", "video"],
          output: ["text"],
        },
      }),
    );
    expect(withImage.supportsVision).toBe(true);
    expect(withImage.inputModalities).toEqual(["text", "image", "audio", "video"]);

    const textOnly = mergeModelInfoWithModelsDev(
      {
        model: "text",
        contextWindow: CATALOG_DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: CATALOG_DEFAULT_MAX_OUTPUT_TOKENS,
      },
      stubModel({
        id: "text",
        name: "Text",
        modalities: { input: ["text"], output: ["text"] },
      }),
    );
    expect(textOnly.supportsVision).toBe(false);
    expect(textOnly.inputModalities).toEqual(["text"]);
  });
});
