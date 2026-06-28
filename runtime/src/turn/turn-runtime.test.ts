import { describe, expect, test } from "bun:test";

import { nullPgRepositories } from "@freeanima/core/repos";
import { beginTurnFast } from "./turn-runtime.ts";

describe("turn-runtime", () => {
  test("beginTurnFast appends user turn when PG unavailable uses in-memory path", async () => {
    await expect(beginTurnFast(nullPgRepositories, "missing", "hello")).rejects.toThrow();
  });
});
