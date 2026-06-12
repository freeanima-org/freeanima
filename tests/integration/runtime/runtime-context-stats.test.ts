import { computeStats, statsReport, getAppRuntime } from "@freeanima/service";
import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/core/tokenizer";
import {
  bindModelToFallbackForTest,
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/core/tokenizer/testing";

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
    setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, (text: string) => {
      const len = text.trim().length;
      if (!len) return [];
      const n = Math.max(1, Math.ceil(len / 3.5));
      return Array.from({ length: n }, (_, i) => i + 1);
    });
    await ensureFallbackTokenizer();
    bindModelToFallbackForTest("m");
  });

  afterEach(async () => {
    resetTokenizerForTest();
    await restoreIntegrationHome(prev);
  });

  it("breakdown includes tools and system parts from runtime view", async () => {
    getTestEngine().toolSets.registerToolSet("__ctx_stats__", "test", [
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
      system_prompt: "self layer block here\n\n## Resident memory\n- fact",
      tools: ["ctx_stats_big_tool"],
    });
    await c.appendMessage({ role: "user", content: "hi", pos: 1 }, sid);
    await c.appendMessage({ role: "assistant", content: "ok", pos: 2 }, sid);

    const stats = await computeStats(getAppRuntime().runtimeDeps(), sid);
    expect(stats.context_breakdown.tools).toBeGreaterThan(stats.context_breakdown.messages);
    expect(stats.context_tokens_est).toBe(stats.context_breakdown.total);
    expect(stats.compression_mode).toBe("token");

    const report = await statsReport(getAppRuntime().runtimeDeps(), sid);
    expect(report).toContain("Tool schema:");
    expect(report).toContain("Mode: token utilization");
    expect(report).not.toContain("message-count fallback");
    expect(report).toContain("runtime view");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
