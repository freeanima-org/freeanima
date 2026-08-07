import { describe, expect, it } from "bun:test";
import { ToolRoundBuffer } from "./tool-round-buffer.ts";

describe("ToolRoundBuffer progress", () => {
  it("keeps status running while updating partial result", () => {
    const buffer = new ToolRoundBuffer();
    buffer.addBegin("subagent_run", { _title: "调研" });
    buffer.addProgress(
      "subagent_run",
      JSON.stringify({
        ok: true,
        action: "run",
        results: [
          {
            slug: "general",
            status: "running",
            steps: [{ name: "web_search", status: "running" }],
          },
        ],
      }),
    );
    const live = buffer.snapshot();
    expect(live).toHaveLength(1);
    expect(live[0]?.status).toBe("running");
    expect(live[0]?.result).toContain("web_search");

    buffer.addProgress(
      "subagent_run",
      JSON.stringify({
        ok: true,
        action: "run",
        results: [
          {
            slug: "general",
            status: "running",
            steps: [
              { name: "web_search", status: "done" },
              { name: "file_read", title: "读配置", status: "running" },
            ],
          },
        ],
      }),
    );
    const live2 = buffer.snapshot();
    expect(live2[0]?.status).toBe("running");
    expect(live2[0]?.result).toContain("读配置");

    buffer.addResult(
      "subagent_run",
      JSON.stringify({
        ok: true,
        action: "run",
        results: [
          { slug: "general", status: "ok", steps: [{ name: "file_read", status: "done" }] },
        ],
      }),
    );
    const done = buffer.snapshot();
    expect(done[0]?.status).toBe("done");
    expect(done[0]?.result).toContain('"status":"ok"');
  });
});
