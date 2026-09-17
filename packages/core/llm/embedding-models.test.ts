import { describe, expect, it } from "bun:test";
import {
  filterChatCatalog,
  filterEmbeddingCatalog,
  looksLikeEmbeddingModelId,
} from "./embedding-models.ts";

describe("looksLikeEmbeddingModelId", () => {
  it("识别常见嵌入模型 id", () => {
    expect(looksLikeEmbeddingModelId("bge-m3")).toBe(true);
    expect(looksLikeEmbeddingModelId("bge-m3:latest")).toBe(true);
    expect(looksLikeEmbeddingModelId("bge-m3-4t:latest")).toBe(true);
    expect(looksLikeEmbeddingModelId("nomic-embed-text")).toBe(true);
    expect(looksLikeEmbeddingModelId("text-embedding-3-small")).toBe(true);
    expect(looksLikeEmbeddingModelId("mxbai-embed-large")).toBe(true);
    expect(looksLikeEmbeddingModelId("snowflake-arctic-embed")).toBe(true);
  });

  it("排除对话模型", () => {
    expect(looksLikeEmbeddingModelId("qwen3.5:4b")).toBe(false);
    expect(looksLikeEmbeddingModelId("llama3.2:3b")).toBe(false);
    expect(looksLikeEmbeddingModelId("deepseek-chat")).toBe(false);
    expect(looksLikeEmbeddingModelId("phi4-mini:latest")).toBe(false);
  });
});

describe("filterEmbeddingCatalog / filterChatCatalog", () => {
  const catalog = [
    { model: "qwen3.5:4b", label: "Qwen", contextWindow: 1, maxOutputTokens: 1 },
    { model: "bge-m3:latest", label: "BGE", contextWindow: 1, maxOutputTokens: 1 },
    { model: "bge-m3-4t:latest", contextWindow: 1, maxOutputTokens: 1 },
    { model: "llama3.2:3b", contextWindow: 1, maxOutputTokens: 1 },
    {
      model: "custom-vec",
      contextWindow: 1,
      maxOutputTokens: 1,
      outputModalities: ["embedding"] as const,
    },
  ];

  it("embedding 只留向量模型", () => {
    expect(filterEmbeddingCatalog(catalog).map((m) => m.model)).toEqual([
      "bge-m3:latest",
      "bge-m3-4t:latest",
      "custom-vec",
    ]);
  });

  it("chat 排除向量模型", () => {
    expect(filterChatCatalog(catalog).map((m) => m.model)).toEqual(["qwen3.5:4b", "llama3.2:3b"]);
  });

  it("支持 query", () => {
    expect(filterEmbeddingCatalog(catalog, { query: "4t" }).map((m) => m.model)).toEqual([
      "bge-m3-4t:latest",
    ]);
    expect(filterChatCatalog(catalog, { query: "qwen" }).map((m) => m.model)).toEqual([
      "qwen3.5:4b",
    ]);
  });
});
