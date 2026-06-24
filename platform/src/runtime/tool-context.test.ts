import { runWithToolContext, getToolSessionId, getToolContextKind } from "@freeanima/core/tool";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { describe, it, expect } from "bun:test";

const tools = new ToolSetRegistry();

describe("runWithToolContext", () => {
  it("returns undefined session id in auto_llm context", () => {
    const sid = runWithToolContext("autollm_1", () => getToolSessionId(), {
      tools,
      contextKind: "auto_llm",
    });
    expect(sid).toBeUndefined();
    expect(getToolContextKind()).toBeUndefined();
  });

  it("propagates session through async generator iteration", async () => {
    async function* inner() {
      await Promise.resolve();
      yield getToolSessionId();
      await Promise.resolve();
      yield getToolSessionId();
    }

    const seen: (string | undefined)[] = [];
    for await (const sid of runWithToolContext("sess-stream", () => inner(), { tools })) {
      seen.push(sid);
    }

    expect(seen).toEqual(["sess-stream", "sess-stream"]);
  });

  it("propagates session through promise chain", async () => {
    const sid = await runWithToolContext(
      "sess-promise",
      async () => {
        await Promise.resolve();
        return getToolSessionId();
      },
      { tools },
    );
    expect(sid).toBe("sess-promise");
  });
});
