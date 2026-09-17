import { describe, expect, test } from "bun:test";

import { handleStreamEvent, mergeLlmDebugSnapshot } from "./stream-events.ts";
import type { LlmDebugSnapshotPayload, StreamApiEvent } from "./types.ts";

function snap(phase: "initial" | "final"): LlmDebugSnapshotPayload {
  return {
    phase,
    loop_index: 0,
    model: "m",
    tool_count: 0,
    tools: [],
    invoke: { turns: [] },
  };
}

describe("handleStreamEvent", () => {
  test("token 累加 / content_replace / llm_debug", () => {
    let text = "";
    const patches: Array<{ streamText?: string; streaming?: boolean }> = [];
    const debug: LlmDebugSnapshotPayload[] = [];

    const run = (ev: StreamApiEvent) => {
      const r = handleStreamEvent(ev, text, { onLlmDebug: (s) => debug.push(s) }, (p) => {
        patches.push(p);
        if (p.streamText !== undefined) text = p.streamText;
      });
      text = r.streamText;
      return r;
    };

    run({ event: "accepted", data: {} });
    expect(patches.at(-1)?.streaming).toBe(true);

    run({ event: "token", data: { content: "Hel" } });
    run({ event: "token", data: { content: "lo" } });
    expect(text).toBe("Hello");

    run({ event: "content_replace", data: { content: "Hi" } });
    expect(text).toBe("Hi");

    run({ event: "llm_debug", data: snap("initial") });
    expect(debug).toHaveLength(1);

    const done = run({ event: "done", data: {} });
    expect(done.receivedDone).toBe(true);
  });
});

describe("mergeLlmDebugSnapshot", () => {
  test("按 phase 合并", () => {
    const a = mergeLlmDebugSnapshot(null, snap("initial"));
    expect(a.initial?.phase).toBe("initial");
    const b = mergeLlmDebugSnapshot(a, snap("final"));
    expect(b.initial?.phase).toBe("initial");
    expect(b.final?.phase).toBe("final");
  });
});
