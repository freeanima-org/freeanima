import { describe, expect, it } from "bun:test";
import { beginTurnFast } from "./turn-runtime.ts";

describe("beginTurnFast", () => {
  it("throws when conversation does not exist in PG", async () => {
    await expect(beginTurnFast("missing-conversation-id", "hello")).rejects.toThrow();
  });
});
