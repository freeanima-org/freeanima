import type { StreamEvent } from "@freeanima/orchestration-loop";
import { describe, expect, it } from "bun:test";
import { ToolRoundCollector } from "../stream-tool-format.ts";
import { applyStreamEvent, initialStreamReplyState, reduceStreamEvents } from "./reducer.ts";
import { projectVisibleText } from "./project.ts";

async function* streamEvents(items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of items) yield ev;
}

function reduceAll(items: StreamEvent[], platform: "discord" | "weixin" | "parlor" = "discord") {
  let state = initialStreamReplyState();
  const effects: ReturnType<typeof applyStreamEvent>["effects"] = [];
  const collector = new ToolRoundCollector();
  for (const event of items) {
    const result = applyStreamEvent(state, event, platform, collector);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

describe("applyStreamEvent", () => {
  it("token streams into one segment without premature commit", () => {
    const { effects } = reduceAll([
      { event: "token", data: { content: "hel" } },
      { event: "token", data: { content: "lo" } },
      { event: "done", data: {} },
    ]);
    const commits = effects.filter((e) => e.kind === "answer_commit");
    expect(commits).toHaveLength(0);
    expect(effects.filter((e) => e.kind === "answer_delta")).toHaveLength(2);
    expect(effects.at(-2)).toEqual({ kind: "answer_finalize", content: "hello" });
  });

  it("tool_begin commits current answer segment", () => {
    const { effects } = reduceAll([
      { event: "token", data: { content: "part1" } },
      { event: "tool_begin", data: { name: "search", args: { q: "x" } } },
      { event: "tool_result", data: { name: "search", content: "hit" } },
      { event: "token", data: { content: "part2" } },
      { event: "done", data: {} },
    ]);
    const commitIdx = effects.findIndex((e) => e.kind === "answer_commit" && e.content === "part1");
    const toolIdx = effects.findIndex((e) => e.kind === "tool_round");
    const part2Delta = effects.findIndex((e) => e.kind === "answer_delta" && e.delta === "part2");
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(toolIdx).toBeGreaterThan(commitIdx);
    expect(part2Delta).toBeGreaterThan(toolIdx);
  });

  it("content_replace overwrites answer", () => {
    const { effects } = reduceAll([
      { event: "token", data: { content: "draft" } },
      { event: "content_replace", data: { content: "final" } },
      { event: "done", data: {} },
    ]);
    expect(effects.some((e) => e.kind === "answer_replace" && e.content === "final")).toBe(true);
    expect(effects.at(-2)).toEqual({ kind: "answer_finalize", content: "final" });
  });

  it("interrupted emits turn_end", () => {
    const { state, effects } = reduceAll([
      { event: "token", data: { content: "x" } },
      { event: "interrupted", data: { reason: "preempted" } },
    ]);
    expect(state.terminal?.kind).toBe("interrupted");
    expect(effects.at(-1)).toEqual({
      kind: "turn_end",
      reason: "interrupted",
      message: "preempted",
    });
  });

  it("tool round before first token", async () => {
    const { state } = await reduceStreamEvents(
      streamEvents([
        { event: "tool_begin", data: { name: "read", args: {} } },
        { event: "tool_result", data: { name: "read", content: "ok" } },
        { event: "token", data: { content: "answer" } },
        { event: "done", data: {} },
      ]),
      "weixin",
    );
    expect(projectVisibleText(state)).toContain("read");
    expect(projectVisibleText(state)).toContain("answer");
  });
});

describe("projectVisibleText", () => {
  it("matches collect-gateway style output", async () => {
    const { state } = await reduceStreamEvents(
      streamEvents([
        { event: "token", data: { content: "Hello" } },
        { event: "done", data: {} },
      ]),
      "weixin",
    );
    expect(projectVisibleText(state)).toBe("Hello");
  });
});
