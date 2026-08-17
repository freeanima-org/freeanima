import { describe, expect, it } from "bun:test";

import { mergeSection, replaceSection } from "./habitat-runtime-config-repo.ts";

describe("habitat-runtime-config section merge vs replace", () => {
  it("mergeSection 浅合并 record，无法删除已有条目", () => {
    const doc = {
      mcp_servers: {
        gh: { command: "npx", args: ["@modelcontextprotocol/server-github"] },
        pg: { command: "npx", args: ["@modelcontextprotocol/server-postgres"] },
      },
    };
    const next = mergeSection(doc, "mcp_servers", {
      pg: { command: "npx", args: ["@modelcontextprotocol/server-postgres", "postgresql://…"] },
    });
    expect(next.mcp_servers).toEqual({
      gh: { command: "npx", args: ["@modelcontextprotocol/server-github"] },
      pg: { command: "npx", args: ["@modelcontextprotocol/server-postgres", "postgresql://…"] },
    });
  });

  it("replaceSection 整段替换 record，可删除条目", () => {
    const doc = {
      mcp_servers: {
        gh: { command: "npx", args: ["@modelcontextprotocol/server-github"] },
        pg: { command: "npx", args: ["@modelcontextprotocol/server-postgres"] },
      },
    };
    const next = replaceSection(doc, "mcp_servers", {
      pg: { command: "npx", args: ["@modelcontextprotocol/server-postgres"] },
    });
    expect(next.mcp_servers).toEqual({
      pg: { command: "npx", args: ["@modelcontextprotocol/server-postgres"] },
    });
  });

  it("llm mergeSection 对 providers/scenes 做条目级合并", () => {
    const doc = {
      llm: {
        default_profile: "chat",
        providers: {
          main: { api_key: "k1", format: "openai_compatible" },
        },
        scenes: {
          chat: { connection: "main", model: "m1" },
        },
      },
    };
    const next = mergeSection(doc, "llm", {
      providers: {
        edge: { voice_protocol: "edge-tts", api_key: "" },
      },
      scenes: {
        tts: { connection: "edge", model: "v1" },
      },
    });
    const llm = next.llm as {
      providers: Record<string, unknown>;
      scenes: Record<string, unknown>;
    };
    expect(Object.keys(llm.providers).toSorted()).toEqual(["edge", "main"]);
    expect(Object.keys(llm.scenes).toSorted()).toEqual(["chat", "tts"]);
  });

  it("llm mergeSection 条目 null 可删除 providers/scenes", () => {
    const doc = {
      llm: {
        default_profile: "chat",
        providers: {
          main: { api_key: "k1", format: "openai_compatible" },
          edge: { voice_protocol: "edge-tts", api_key: "" },
        },
        scenes: {
          chat: { connection: "main", model: "m1" },
          tts: { connection: "edge", model: "v1" },
        },
      },
    };
    const next = mergeSection(doc, "llm", {
      providers: { edge: null },
      scenes: { tts: null },
    });
    const llm = next.llm as {
      providers: Record<string, unknown>;
      scenes: Record<string, unknown>;
    };
    expect(Object.keys(llm.providers).toSorted()).toEqual(["main"]);
    expect(Object.keys(llm.scenes).toSorted()).toEqual(["chat"]);
  });
});
