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
});
