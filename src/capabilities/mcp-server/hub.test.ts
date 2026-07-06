import { describe, it, expect } from "bun:test";
import { ToolSetRegistry, toolResult } from "@freeanima/core/tool";
import { createMcpBunHandler, isMcpPath } from "./hub.ts";

describe("isMcpPath", () => {
  it("matches /mcp paths", () => {
    expect(isMcpPath("/mcp")).toBe(true);
    expect(isMcpPath("/mcp/")).toBe(true);
    expect(isMcpPath("/api/mcp")).toBe(false);
  });
});

describe("createMcpBunHandler", () => {
  it("returns undefined for non-mcp paths", async () => {
    const registry = new ToolSetRegistry();
    const handler = createMcpBunHandler({ toolSets: registry });
    expect(await handler(new Request("http://127.0.0.1/api/health"))).toBeUndefined();
  });

  it("lists only exposeMcp tools", async () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("demo", "Demo", [
      {
        name: "visible_tool",
        description: "visible",
        parameters: { type: "object", properties: {} },
        exposeMcp: true,
        handler: () => toolResult({ ok: true }),
      },
      {
        name: "hidden_tool",
        description: "hidden",
        parameters: { type: "object", properties: {} },
        handler: () => toolResult({ ok: false }),
      },
    ]);
    const handler = createMcpBunHandler({ toolSets: registry });
    const res = await handler(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
    );
    expect(res).toBeDefined();
    expect(res!.ok).toBe(true);
    const body = await res!.json();
    const tools = body.result?.tools ?? [];
    expect(tools.map((t: { name: string }) => t.name)).toEqual(["visible_tool"]);
  });

  it("rejects call for non-exposed tool", async () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("demo", "Demo", [
      {
        name: "hidden_tool",
        description: "hidden",
        parameters: { type: "object", properties: {} },
        handler: () => toolResult({ ok: true }),
      },
    ]);
    const handler = createMcpBunHandler({ toolSets: registry });
    const initRes = await handler(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(initRes?.ok).toBe(true);

    const callRes = await handler(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "hidden_tool", arguments: {} },
        }),
      }),
    );
    expect(callRes?.ok).toBe(true);
    const body = await callRes!.json();
    expect(body.result?.isError).toBe(true);
  });
});
