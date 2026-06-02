import { runWithToolContext, getToolSessionId } from "@freeanima/legacy-engine";
import { describe, it, expect } from "vitest";


describe("runWithToolContext", () => {
  it("propagates session through async generator iteration", async () => {
    async function* inner() {
      await Promise.resolve();
      yield getToolSessionId();
      await Promise.resolve();
      yield getToolSessionId();
    }

    const seen: (string | undefined)[] = [];
    for await (const sid of runWithToolContext("sess-stream", () => inner())) {
      seen.push(sid);
    }

    expect(seen).toEqual(["sess-stream", "sess-stream"]);
  });

  it("propagates session through promise chain", async () => {
    const sid = await runWithToolContext("sess-promise", async () => {
      await Promise.resolve();
      return getToolSessionId();
    });
    expect(sid).toBe("sess-promise");
  });
});
