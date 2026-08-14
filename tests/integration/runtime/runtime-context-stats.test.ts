import { computeStats, statsReport, getAppRuntime } from "@freeanima/habitat/platform";
import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCaseWithConfig,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/habitat/core/tokenizer";
import {
  bindModelToFallbackForTest,
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/habitat/core/tokenizer/testing";

describePg("runtime context stats", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCaseWithConfig(
      "anima-ctx-stats-",
      `models:
  test-model:
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
    // 预算走 PROFILE_CHAT hop（test-model），不再读会话 meta.model
    bindModelToFallbackForTest("test-model");
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
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    await c.updateConversationMetaField(sid, {
      model: "stale-meta-model",
      system_prompt: "self layer block here\n\n<resident_memory>\n- fact\n</resident_memory>",
      cached_toolsets: ["__ctx_stats__"],
    });
    await c.appendMessage({ role: "user", content: "hi", pos: 1 }, sid);
    await c.appendMessage({ role: "assistant", content: "ok", pos: 2 }, sid);

    const stats = await computeStats(getAppRuntime().runtimeDeps(), sid);
    expect(stats.context_breakdown.tools).toBeGreaterThan(stats.context_breakdown.messages);
    expect(stats.context_tokens_est).toBe(stats.context_breakdown.total);
    expect(stats.compression_mode).toBe("token");

    const report = await statsReport(getAppRuntime().runtimeDeps(), sid);
    expect(report).toContain("Tool schema:");
    expect(report).toContain("Mode: token");
    expect(report).not.toContain("message-count fallback");
    expect(report).toContain("runtime view");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
