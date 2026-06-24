import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { normalizeUsage } from "@freeanima/core/llm";
import { estimateTokens, estimateMessagesTokens } from "@freeanima/core/compress";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/core/tokenizer";
import {
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/core/tokenizer/testing";
import { computeStats, mergeStats, statsReport, getAppRuntime } from "@freeanima/platform";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import { testConv } from "../../helpers/pg-test.ts";

function deps() {
  return getAppRuntime().runtimeDeps();
}

describePg("conversation-stats", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-stats-");
    setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, (text: string) => {
      const len = text.trim().length;
      if (!len) return [];
      const n = Math.max(1, Math.ceil(len / 3.5));
      return Array.from({ length: n }, (_, i) => i + 1);
    });
    await ensureFallbackTokenizer();
  });

  afterEach(async () => {
    resetTokenizerForTest();
    await restoreIntegrationHome(prev);
  });

  it("normalizeUsage handles cached tokens", () => {
    const raw = {
      prompt_tokens: 100,
      completion_tokens: 40,
      prompt_tokens_details: { cached_tokens: 25 },
    };
    expect(normalizeUsage(raw)).toEqual({
      prompt_tokens: 100,
      completion_tokens: 40,
      cached_tokens: 25,
    });
  });

  it("computeStats empty session", async () => {
    const stats = await computeStats(deps(), "no_such_session_xyz");
    expect(stats.message_count).toBe(0);
    expect(stats.input_tokens).toBeNull();
  });

  it("computeStats with usage and latency", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    await c.appendMessage(
      {
        role: "user",
        content: "hi",
        pos: 1,
        timestamp: "2026-05-01T10:00:00+08:00",
      },
      sid,
    );
    await c.appendMessage(
      {
        role: "assistant",
        content: "hello",
        timestamp: "2026-05-01T10:00:05+08:00",
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        latency_ms: 500,
      },
      sid,
    );
    const stats = await computeStats(deps(), sid);
    expect(stats.message_count).toBe(2);
    expect(stats.input_tokens).toBe(10);
    expect(stats.output_tokens).toBe(5);
    expect(stats.avg_tps).toBeGreaterThan(0);
  });

  it("mergeStats aggregates", async () => {
    const a = await computeStats(deps(), "no_such_session_xyz");
    const merged = mergeStats([a], "Summary (1 conversation)");
    expect(merged.conversation).toContain("Summary");
  });

  it("statsReport for missing session", async () => {
    expect(await statsReport(deps(), "missing_session_xyz")).toContain("(empty)");
  });

  it("estimateTokens and estimateMessagesTokens", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBeGreaterThan(0);
    expect(estimateMessagesTokens([{ role: "user", content: "hello world" }])).toBeGreaterThan(0);
  });

  it("computeStats estimates when no usage in messages", async () => {
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    await c.updateConversationMetaField(sid, { compression: { l2: 0, l3: 2 } });
    await c.appendMessage(
      {
        role: "user",
        content: "hi",
        pos: 1,
        timestamp: "2026-05-01T10:00:00+08:00",
      },
      sid,
    );
    await c.appendMessage(
      {
        role: "assistant",
        content: "hello world",
        pos: 2,
        timestamp: "2026-05-01T10:00:05+08:00",
      },
      sid,
    );
    const stats = await computeStats(deps(), sid);
    expect(stats.estimated_usage).toBe(true);
    expect(stats.input_tokens).not.toBeNull();
    expect(stats.output_tokens).not.toBeNull();
    expect(stats.compression_l3).toBe(2);
    const report = await statsReport(deps(), sid);
    expect(report).toContain("Session compression:");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
