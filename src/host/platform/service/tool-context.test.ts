import {
  runWithToolContext,
  getToolConversationId,
  getToolContextKind,
} from "@freeanima/host/core/tool";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { describe, it, expect } from "bun:test";

const tools = new ToolSetRegistry();

describe("runWithToolContext", () => {
  it("returns undefined conversation id in auto_llm context", () => {
    const sid = runWithToolContext("autollm_1", () => getToolConversationId(), {
      tools,
      contextKind: "auto_llm",
    });
    expect(sid).toBeUndefined();
    expect(getToolContextKind()).toBeUndefined();
  });

  it("propagates conversation through async generator iteration", async () => {
    async function* inner() {
      await Promise.resolve();
      yield getToolConversationId();
      await Promise.resolve();
      yield getToolConversationId();
    }

    const seen: (string | undefined)[] = [];
    for await (const sid of runWithToolContext("sess-stream", () => inner(), { tools })) {
      seen.push(sid);
    }

    expect(seen).toEqual(["sess-stream", "sess-stream"]);
  });

  it("propagates conversation through promise chain", async () => {
    const sid = await runWithToolContext(
      "sess-promise",
      async () => {
        await Promise.resolve();
        return getToolConversationId();
      },
      { tools },
    );
    expect(sid).toBe("sess-promise");
  });
});
