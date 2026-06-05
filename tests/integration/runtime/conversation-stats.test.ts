import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import {
  normalizeUsage,
  estimateTokens,
  estimateMessagesTokens,
  newSession,
  appendMessage,
  updateSessionMetaField,
} from "@freeanima/engine";
import { computeStats, mergeStats, statsReport } from "@freeanima/legacy-runtime";

describePg("conversation-stats", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-stats-");
  });

  afterEach(async () => {
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
    const stats = await computeStats("no_such_session_xyz");
    expect(stats.message_count).toBe(0);
    expect(stats.input_tokens).toBeNull();
  });

  it("computeStats with usage and latency", async () => {
    const sid = await newSession("parlor");
    await appendMessage(
      {
        role: "user",
        content: "hi",
        pos: 1,
        timestamp: "2026-05-01T10:00:00+08:00",
      },
      sid,
    );
    await appendMessage(
      {
        role: "assistant",
        content: "hello",
        timestamp: "2026-05-01T10:00:05+08:00",
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        latency_ms: 500,
      },
      sid,
    );
    const stats = await computeStats(sid);
    expect(stats.message_count).toBe(2);
    expect(stats.input_tokens).toBe(10);
    expect(stats.output_tokens).toBe(5);
    expect(stats.avg_tps).toBeGreaterThan(0);
  });

  it("mergeStats aggregates", async () => {
    const a = await computeStats("no_such_session_xyz");
    const merged = mergeStats([a], "汇总 (1 个 session)");
    expect(merged.session).toContain("汇总");
  });

  it("statsReport for missing session", async () => {
    expect(await statsReport("missing_session_xyz")).toContain("（空）");
  });

  it("estimateTokens and estimateMessagesTokens", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBeGreaterThan(0);
    expect(estimateMessagesTokens([{ role: "user", content: "你好世界" }])).toBeGreaterThan(0);
  });

  it("computeStats estimates when no usage in messages", async () => {
    const sid = await newSession("parlor");
    await updateSessionMetaField(sid, { compression: { l2: 0, l3: 2 } });
    await appendMessage(
      {
        role: "user",
        content: "hi",
        pos: 1,
        timestamp: "2026-05-01T10:00:00+08:00",
      },
      sid,
    );
    await appendMessage(
      {
        role: "assistant",
        content: "hello world",
        pos: 2,
        timestamp: "2026-05-01T10:00:05+08:00",
      },
      sid,
    );
    const stats = await computeStats(sid);
    expect(stats.estimated_usage).toBe(true);
    expect(stats.input_tokens).not.toBeNull();
    expect(stats.output_tokens).not.toBeNull();
    expect(stats.compression_l3).toBe(2);
    const report = await statsReport(sid);
    expect(report).toContain("会话压缩:");
    expect(report).toContain("当前上下文（运行时视图");
    expect(report).toContain("usage 记录: 0/1");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
