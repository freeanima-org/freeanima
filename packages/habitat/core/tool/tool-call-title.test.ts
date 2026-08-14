import { describe, expect, it } from "bun:test";
import {
  TOOL_CALL_TITLE_KEY,
  injectToolCallTitle,
  omitToolCallTitle,
  shouldInjectToolCallTitle,
  toolCallTitleFromArgs,
} from "./tool-call-title.ts";
import { ToolSetRegistry } from "./toolset.ts";
import { validateToolArgs } from "./validate-args.ts";

describe("tool-call-title", () => {
  it("injectToolCallTitle adds required _title", () => {
    const next = injectToolCallTitle({
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    });
    expect(next.properties?.[TOOL_CALL_TITLE_KEY]).toEqual({
      type: "string",
      description: 'One-line intent of this call for UI (e.g. "修改配置文件", "merger 10054 pr")',
    });
    expect(next.required).toEqual(["_title", "path"]);
  });

  it("registerToolSet injects for local sets and skips mcp_/acp_", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("file", "File", [
      {
        name: "file_read",
        description: "read",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
        handler: () => "{}",
      },
    ]);
    registry.registerToolSet("mcp_gh", "MCP", [
      {
        name: "mcp_gh_issue",
        description: "issue",
        parameters: {
          type: "object",
          properties: { id: { type: "number" } },
          required: ["id"],
        },
        handler: () => "{}",
      },
    ]);
    expect(registry.getTool("file_read")?.parameters.required).toContain("_title");
    expect(registry.getTool("mcp_gh_issue")?.parameters.required).not.toContain("_title");
    expect(shouldInjectToolCallTitle("acp_cursor")).toBe(false);
  });

  it("validateToolArgs requires _title after inject", () => {
    const params = injectToolCallTitle({
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    });
    expect(validateToolArgs(params, { path: "/a" }).ok).toBe(false);
    const ok = validateToolArgs(params, { _title: "读配置", path: "/a" });
    expect(ok).toEqual({ ok: true, data: { _title: "读配置", path: "/a" } });
  });

  it("omitToolCallTitle strips UI field", () => {
    expect(omitToolCallTitle({ _title: "x", path: "/a" })).toEqual({ path: "/a" });
  });

  it("toolCallTitleFromArgs reads trimmed string", () => {
    expect(toolCallTitleFromArgs({ _title: "  修改配置文件  " })).toBe("修改配置文件");
    expect(toolCallTitleFromArgs({ _title: "   " })).toBeUndefined();
    expect(toolCallTitleFromArgs({})).toBeUndefined();
  });
});
