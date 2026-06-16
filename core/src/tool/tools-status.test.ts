import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { defineToolReturn } from "./return-contract.ts";
import { DEFAULT_SESSION_TOOLSETS } from "./default-session-toolsets.ts";
import { ToolSetRegistry } from "./toolset.ts";
import { buildToolsStatus, resolveReturnKind } from "./tools-status.ts";

describe("resolveReturnKind", () => {
  const base = {
    name: "demo_tool",
    description: "demo",
    parameters: { type: "object" },
    handler: () => "{}",
  };

  it("explicit returnKind takes precedence", () => {
    expect(resolveReturnKind("file", { ...base, returnKind: "json" })).toBe("json");
    expect(resolveReturnKind(undefined, { ...base, returnKind: "text" })).toBe("text");
  });

  it("infers mcp_ / acp_ ToolSet as text", () => {
    expect(resolveReturnKind("mcp_github", base)).toBe("text");
    expect(resolveReturnKind("acp_cursor", base)).toBe("text");
  });

  it("infers built-in plain-text tools as text", () => {
    expect(resolveReturnKind("file", { ...base, name: "file_read" })).toBe("text");
    expect(resolveReturnKind("terminal", { ...base, name: "terminal_run" })).toBe("text");
    expect(resolveReturnKind("code", { ...base, name: "code_execute" })).toBe("text");
  });

  it("defaults others to json", () => {
    expect(resolveReturnKind("memory", { ...base, name: "memory_recall" })).toBe("json");
  });
});

describe("buildToolsStatus", () => {
  it("assembles definition, return_kind, and default_toolsets", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("toolset", "discovery", [
      {
        name: "toolset_search",
        description: "Search toolsets",
        parameters: { type: "object", properties: { query: { type: "string" } } },
        handler: () => "{}",
      },
    ]);
    registry.registerToolSet("file", "files", [
      {
        name: "file_read",
        description: "Read file",
        parameters: { type: "object", properties: { path: { type: "string" } } },
        handler: () => "content",
      },
      {
        name: "file_write",
        description: "Write file",
        parameters: { type: "object" },
        handler: () => '{"ok":true}',
        ...defineToolReturn({
          schema: z.object({ ok: z.literal(true), path: z.string() }),
          example: { ok: true, path: "/tmp/demo.txt" },
        }),
      },
    ]);
    registry.registerToolSet("mcp_demo", "MCP", [
      {
        name: "mcp_demo_ping",
        description: "MCP ping",
        parameters: { type: "object" },
        handler: () => "pong",
      },
    ]);

    const status = buildToolsStatus(registry);

    expect(status.default_toolsets).toEqual(
      DEFAULT_SESSION_TOOLSETS.filter((n) => registry.getToolSet(n) != null),
    );
    expect(status.default_toolsets).toContain("toolset");

    const read = status.tools.find((t) => t.name === "file_read");
    expect(read?.return_kind).toBe("text");
    expect(read?.definition.type).toBe("function");
    expect(read?.definition.function.name).toBe("file_read");
    expect(read?.toolset).toBe("file");

    const write = status.tools.find((t) => t.name === "file_write");
    expect(write?.return_kind).toBe("json");
    expect(write?.return_schema?.type).toBe("object");
    expect(write?.return_example).toEqual({ ok: true, path: "/tmp/demo.txt" });
    expect(write?.error_schema?.type).toBe("object");
    expect(write?.error_example).toEqual({ error: "Example error message" });

    const mcp = status.tools.find((t) => t.name === "mcp_demo_ping");
    expect(mcp?.return_kind).toBe("text");

    expect(status.toolsets.map((ts) => ts.name)).toEqual(["toolset", "file", "mcp_demo"]);
  });
});
