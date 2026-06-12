import { runWithToolContext, getToolSessionId } from "@freeanima/mechanism-tool";
import { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { describe, it, expect } from "bun:test";

const tools = new ToolSetRegistry();

describe("runWithToolContext", () => {
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
