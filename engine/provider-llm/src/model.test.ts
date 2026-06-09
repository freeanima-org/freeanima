import { describe, expect, it } from "bun:test";
import { clampCallParams, mergeCallParams, modelSupports, type ModelInfo } from "./model.ts";

describe("mergeCallParams", () => {
  it("later layers override earlier keys", () => {
    expect(mergeCallParams({ temperature: 0.2 }, { temperature: 0.8 }, { topP: 0.9 })).toEqual({
      temperature: 0.8,
      topP: 0.9,
    });
  });

  it("merges extra objects shallowly", () => {
    expect(mergeCallParams({ extra: { a: 1 } }, { extra: { b: 2 } })).toEqual({
      extra: { a: 1, b: 2 },
    });
  });

  it("skips undefined layers", () => {
    expect(mergeCallParams(undefined, { temperature: 1 })).toEqual({ temperature: 1 });
  });
});

describe("clampCallParams", () => {
  const modelInfo: ModelInfo = {
    model: "m",
    contextWindow: 100_000,
    maxOutputTokens: 4096,
    supportedParams: ["temperature", "maxOutputTokens"],
  };

  it("caps maxOutputTokens to catalog limit", () => {
    expect(clampCallParams({ maxOutputTokens: 99999, temperature: 0.5 }, modelInfo)).toEqual({
      maxOutputTokens: 4096,
      temperature: 0.5,
    });
  });

  it("drops unsupported params when supportedParams is set", () => {
    expect(clampCallParams({ temperature: 0.5, topP: 0.9, stop: "END" }, modelInfo)).toEqual({
      temperature: 0.5,
    });
  });

  it("keeps stop and extra when listed in supportedParams", () => {
    const info: ModelInfo = {
      model: "m",
      contextWindow: 100_000,
      maxOutputTokens: 4096,
      supportedParams: ["stop", "extra"],
    };
    expect(clampCallParams({ stop: ["END"], extra: { seed: 1 }, temperature: 0.5 }, info)).toEqual({
      stop: ["END"],
      extra: { seed: 1 },
    });
  });

  it("passes through all params when supportedParams is empty", () => {
    const open: ModelInfo = { model: "m", contextWindow: 1, maxOutputTokens: 100 };
    expect(clampCallParams({ topP: 0.5, stop: "x" }, open)).toEqual({ topP: 0.5, stop: "x" });
  });
});

describe("modelSupports", () => {
  it("returns true when supportedParams omitted", () => {
    expect(modelSupports({ model: "m", contextWindow: 1, maxOutputTokens: 1 }, "tools")).toBe(true);
  });

  it("checks membership when supportedParams present", () => {
    const info: ModelInfo = {
      model: "m",
      contextWindow: 1,
      maxOutputTokens: 1,
      supportedParams: ["temperature", "tools"],
    };
    expect(modelSupports(info, "tools")).toBe(true);
    expect(modelSupports(info, "streaming")).toBe(false);
  });
});
