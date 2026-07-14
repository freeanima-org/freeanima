import { afterEach, describe, expect, it } from "bun:test";

import { FALLBACK_TOKENIZER_REPO, TOKENX_ESTIMATE_REPO } from "./constants.ts";
import { generateCandidateRepos, toPascalCaseModel } from "./resolve.ts";
import {
  bindModelForTest,
  bindModelToFallbackForTest,
  countTokens,
  ensureFallbackTokenizer,
  ensureTokenizer,
  getActiveTokenizerRepo,
  isUsingFallbackTokenizer,
  listLoadedTokenizerRepos,
  releaseTokenizerRepo,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
  splitTextByTokenLimit,
} from "./store.ts";

describe("toPascalCaseModel", () => {
  it("deepseek-v4-flash → DeepseekV4Flash", () => {
    expect(toPascalCaseModel("deepseek-v4-flash")).toBe("DeepseekV4Flash");
  });
});

describe("generateCandidateRepos", () => {
  it("bge-m3 includes BAAI/bge-m3", () => {
    expect(generateCandidateRepos("bge-m3")).toContain("BAAI/bge-m3");
  });

  it("org/name passthrough", () => {
    expect(generateCandidateRepos("BAAI/bge-m3")).toEqual(["BAAI/bge-m3"]);
  });
});

describe("countTokens with test encode", () => {
  afterEach(() => {
    resetTokenizerForTest();
  });

  function wireFallback(charsPerToken: number): void {
    setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, (text) => {
      const len = text.trim().length;
      if (!len) return [];
      const n = Math.max(1, Math.ceil(len / charsPerToken));
      return Array.from({ length: n }, (_, i) => i + 1);
    });
  }

  it("empty text is 0", async () => {
    wireFallback(3.5);
    await ensureFallbackTokenizer();
    expect(countTokens("", "m")).toBe(0);
  });

  it("uses fallback when model resolve fails", async () => {
    wireFallback(4);
    await ensureFallbackTokenizer();
    bindModelToFallbackForTest("unknown-model-xyz");
    expect(isUsingFallbackTokenizer("unknown-model-xyz")).toBe(true);
    expect(getActiveTokenizerRepo("unknown-model-xyz")).toBe(FALLBACK_TOKENIZER_REPO);
    expect(countTokens("abcd", "unknown-model-xyz")).toBe(1);
  });

  it("binds models to tokenx estimate without HF fallback", async () => {
    await ensureTokenizer("gpt-4o");
    expect(isUsingFallbackTokenizer("gpt-4o")).toBe(false);
    expect(getActiveTokenizerRepo("gpt-4o")).toBe(TOKENX_ESTIMATE_REPO);
    expect(countTokens("hello world", "gpt-4o")).toBeGreaterThan(0);
    expect(listLoadedTokenizerRepos()).toContain(TOKENX_ESTIMATE_REPO);
  });

  it("countTokens uses tokenx when no test encode is installed", async () => {
    await ensureTokenizer("deepseek-v4-pro");
    expect(countTokens("你好世界 hello", "deepseek-v4-pro")).toBeGreaterThan(0);
  });

  it("splitTextByTokenLimit respects max tokens", async () => {
    wireFallback(1);
    await ensureFallbackTokenizer();
    bindModelToFallbackForTest("split-test");
    const text = "a".repeat(10);
    const chunks = splitTextByTokenLimit(text, 3, "split-test");
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countTokens(chunk, "split-test")).toBeLessThanOrEqual(3);
    }
  });

  it("evicts unused fallback after primary bind", async () => {
    wireFallback(4);
    setTokenizerEncodeForTest("Org/model", (text) => {
      const len = text.trim().length;
      return len ? [1] : [];
    });
    await ensureFallbackTokenizer();
    expect(listLoadedTokenizerRepos()).toContain(FALLBACK_TOKENIZER_REPO);
    bindModelForTest("chat", "Org/model", "Org/model");
    expect(listLoadedTokenizerRepos()).toEqual(["Org/model"]);
  });

  it("releaseTokenizerRepo refuses when repo still referenced", async () => {
    wireFallback(4);
    await ensureFallbackTokenizer();
    bindModelToFallbackForTest("needs-fallback");
    expect(releaseTokenizerRepo(FALLBACK_TOKENIZER_REPO)).toBe(false);
    expect(listLoadedTokenizerRepos()).toContain(FALLBACK_TOKENIZER_REPO);
  });
});
