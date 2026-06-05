import { computeStats, statsReport } from "@freeanima/legacy-runtime";
import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { beginIntegrationCaseWithConfig } from "../../helpers/integration-case.ts";
import { endIntegrationCase } from "../../helpers/integration-case.ts";
import { newSession, appendMessage, updateSessionMetaField } from "@freeanima/legacy-engine";

describePg("runtime context stats", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCaseWithConfig(
      "anima-ctx-stats-",
      `models:
  m:
    context_window: 128000
compression:
  enabled: true
`,
    );
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("breakdown includes tools and system parts from runtime view", async () => {
    const bigTool = {
      type: "function" as const,
      function: {
        name: "x",
        description: "y".repeat(5000),
        parameters: { type: "object", properties: {} },
      },
    };
    const sid = await newSession("parlor");
    await updateSessionMetaField(sid, {
      model: "m",
      system_prompt: "SOUL block here\n\n## 常驻记忆\n- fact",
      tools: [bigTool],
    });
    await appendMessage({ role: "user", content: "hi", pos: 1 }, sid);
    await appendMessage({ role: "assistant", content: "ok", pos: 2 }, sid);

    const stats = await computeStats(sid);
    expect(stats.context_breakdown.tools).toBeGreaterThan(stats.context_breakdown.messages);
    expect(stats.context_tokens_est).toBe(stats.context_breakdown.total);
    expect(stats.compression_mode).toBe("token");

    const report = await statsReport(sid);
    expect(report).toContain("工具 schema:");
    expect(report).toContain("模式: token 占用率");
    expect(report).not.toContain("按每轮 2 条估");
    expect(report).toContain("运行时视图");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
