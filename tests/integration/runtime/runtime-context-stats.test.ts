import { computeStats, statsReport } from "@freeanima/service";
import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine, testConv } from "../../helpers/pg-test.ts";

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
    await restoreIntegrationHome(prev);
  });

  it("breakdown includes tools and system parts from runtime view", async () => {
    getTestEngine().toolSets.registerToolSet("__ctx_stats__", "测试", [
      {
        name: "ctx_stats_big_tool",
        description: "y".repeat(5000),
        parameters: { type: "object", properties: {} },
        handler: async () => JSON.stringify({ ok: true }),
      },
    ]);
    const c = testConv();
    const sid = await c.newSession("parlor");
    await c.updateSessionMetaField(sid, {
      model: "m",
      system_prompt: "自我层 block here\n\n## 常驻记忆\n- fact",
      tools: ["ctx_stats_big_tool"],
    });
    await c.appendMessage({ role: "user", content: "hi", pos: 1 }, sid);
    await c.appendMessage({ role: "assistant", content: "ok", pos: 2 }, sid);

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
