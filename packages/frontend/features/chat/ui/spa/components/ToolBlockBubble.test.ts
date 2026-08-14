import { describe, expect, it } from "bun:test";
import { collapsedSummary, latestChildTitle } from "./ToolBlockBubble.tsx";
import type { DisplayToolCall } from "@freeanima/features/chat/ui/spa/lib/types.ts";

describe("collapsedSummary / latestChildTitle", () => {
  it("running subagent_run uses latest child title", () => {
    const call: DisplayToolCall = {
      name: "subagent_run",
      argsPreview: "",
      tool_call_id: "1",
      status: "running",
      args: { _title: "调研子代理" },
      result: JSON.stringify({
        ok: true,
        action: "run",
        results: [
          {
            slug: "general",
            status: "running",
            steps: [
              { name: "web_search", title: "搜文档", status: "done" },
              { name: "file_read", title: "读 README", status: "running" },
            ],
          },
        ],
      }),
    };
    expect(collapsedSummary(call)).toBe("读 README");
  });

  it("done subagent_run shows call name / _title", () => {
    const call: DisplayToolCall = {
      name: "subagent_run",
      argsPreview: "",
      tool_call_id: "1",
      status: "done",
      args: { _title: "调研子代理" },
      result: JSON.stringify({
        ok: true,
        action: "run",
        results: [
          {
            slug: "general",
            status: "ok",
            steps: [{ name: "file_read", title: "读 README", status: "done" }],
          },
        ],
      }),
    };
    expect(collapsedSummary(call)).toBe("调研子代理");
  });

  it("running without steps falls back to call label", () => {
    const call: DisplayToolCall = {
      name: "subagent_run",
      argsPreview: "",
      tool_call_id: "1",
      status: "running",
      args: { _title: "调研子代理" },
    };
    expect(collapsedSummary(call)).toBe("调研子代理");
  });

  it("latestChildTitle prefers last running step", () => {
    const title = latestChildTitle([
      {
        steps: [
          { name: "a", title: "A", status: "done" },
          { name: "b", title: "B", status: "running" },
          { name: "c", title: "C", status: "done" },
        ],
      },
    ]);
    expect(title).toBe("B");
  });
});
