import type { StreamEvent } from "../loop-engine.ts";
import { describe, expect, it } from "bun:test";
import { reduceStreamReplyEvents } from "./reducer.ts";

async function collectEffects(events: StreamEvent[]) {
  async function* gen() {
    for (const ev of events) yield ev;
  }
  return reduceStreamReplyEvents(gen());
}

describe("applyStreamReplyEvent / reduceStreamReplyEvents", () => {
  it("single tool round then final answer", async () => {
    const events: StreamEvent[] = [
      { event: "tool_begin", data: { name: "demo_tool", args: { q: "test" } } },
      { event: "tool_result", data: { name: "demo_tool", content: "ok" } },
      { event: "tool_round_end", data: { tool_count: 1 } },
      { event: "token", data: { content: "final z" } },
      { event: "done", data: {} },
    ];
    const { effects } = await collectEffects(events);
    const toolRound = effects.find((e) => e.kind === "tool_round");
    expect(toolRound?.kind).toBe("tool_round");
    if (toolRound?.kind === "tool_round") {
      expect(toolRound.calls).toHaveLength(1);
      expect(toolRound.calls[0]?.name).toBe("demo_tool");
      expect(toolRound.calls[0]?.result).toBe("ok");
    }
    const liveRounds = effects.filter((e) => e.kind === "tool_round_live");
    expect(liveRounds.length).toBeGreaterThanOrEqual(2);
    expect(effects.some((e) => e.kind === "answer_finalize" && e.content === "final z")).toBe(true);
  });

  it("two tool rounds with intermediate answer segment", async () => {
    const events: StreamEvent[] = [
      { event: "tool_begin", data: { name: "read", args: {} } },
      { event: "tool_result", data: { name: "read", content: "ok" } },
      { event: "tool_round_end", data: { tool_count: 1 } },
      { event: "token", data: { content: "x" } },
      { event: "tool_begin", data: { name: "grep", args: { p: "a" } } },
      { event: "tool_result", data: { name: "grep", content: "hit" } },
      { event: "tool_round_end", data: { tool_count: 1 } },
      { event: "token", data: { content: "answer" } },
      { event: "done", data: {} },
    ];
    const { effects } = await collectEffects(events);
    const toolRounds = effects.filter((e) => e.kind === "tool_round");
    expect(toolRounds).toHaveLength(2);
    if (toolRounds[0]?.kind === "tool_round") {
      expect(toolRounds[0].calls[0]?.name).toBe("read");
    }
    if (toolRounds[1]?.kind === "tool_round") {
      expect(toolRounds[1].calls[0]?.name).toBe("grep");
    }
    const commitIdx = effects.findIndex((e) => e.kind === "answer_commit" && e.content === "x");
    const secondRoundIdx = effects.findIndex((e) => e.kind === "tool_round");
    const grepRoundIdx = effects.findIndex(
      (e, i) => i > commitIdx && e.kind === "tool_round" && e.calls.some((c) => c.name === "grep"),
    );
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(grepRoundIdx).toBeGreaterThan(commitIdx);
    expect(grepRoundIdx).toBeGreaterThan(secondRoundIdx);
  });

  it("commits answer before tool_begin", async () => {
    const events: StreamEvent[] = [
      { event: "token", data: { content: "part1" } },
      { event: "tool_begin", data: { name: "read", args: {} } },
      { event: "tool_result", data: { name: "read", content: "ok" } },
      { event: "tool_round_end", data: { tool_count: 1 } },
      { event: "token", data: { content: "part2" } },
      { event: "done", data: {} },
    ];
    const { effects } = await collectEffects(events);
    const commitIdx = effects.findIndex((e) => e.kind === "answer_commit" && e.content === "part1");
    const toolIdx = effects.findIndex((e) => e.kind === "tool_round");
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(toolIdx).toBeGreaterThan(commitIdx);
  });
});
