import { describe, it, expect } from "bun:test";
import { ToolSetRegistry, toolResult } from "@freeanima/host/core/tool";
import { createMcpBunHandler, isMcpPath } from "./http-server.ts";

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

  it("rejects invalid args before calling handler", async () => {
    let calls = 0;
    const registry = new ToolSetRegistry();
    registry.registerToolSet("demo", "Demo", [
      {
        name: "echo_tool",
        description: "echo",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string" },
          },
          required: ["text"],
        },
        exposeMcp: true,
        handler: () => {
          calls += 1;
          return toolResult({ ok: true });
        },
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

    const unknownFieldRes = await handler(
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
          params: { name: "echo_tool", arguments: { text: "ok", tags: ["x"] } },
        }),
      }),
    );
    expect(unknownFieldRes?.ok).toBe(true);
    const unknownBody = await unknownFieldRes!.json();
    expect(unknownBody.result?.isError).toBe(true);
    expect(String(unknownBody.result?.content?.[0]?.text ?? "")).toMatch(/invalid tool arguments/i);
    expect(calls).toBe(0);

    const wrongTypeRes = await handler(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "echo_tool", arguments: { text: 1 } },
        }),
      }),
    );
    expect(wrongTypeRes?.ok).toBe(true);
    const wrongBody = await wrongTypeRes!.json();
    expect(wrongBody.result?.isError).toBe(true);
    expect(calls).toBe(0);
  });
});
