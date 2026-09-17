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

  it("connections mergeSection 做条目级合并", () => {
    const doc = {
      connections: {
        main: { api_key: "k1", preset: "deepseek" },
      },
    };
    const next = mergeSection(doc, "connections", {
      edge: { custom_kind: "audio", audio_protocol: "edge-tts", api_key: "" },
    });
    const connections = next.connections as Record<string, unknown>;
    expect(Object.keys(connections).toSorted()).toEqual(["edge", "main"]);
  });

  it("connections mergeSection 条目 null 可删除", () => {
    const doc = {
      connections: {
        main: { api_key: "k1", preset: "deepseek" },
        edge: { custom_kind: "audio", audio_protocol: "edge-tts", api_key: "" },
      },
    };
    const next = mergeSection(doc, "connections", {
      edge: null,
    });
    const connections = next.connections as Record<string, unknown>;
    expect(Object.keys(connections).toSorted()).toEqual(["main"]);
  });
});
