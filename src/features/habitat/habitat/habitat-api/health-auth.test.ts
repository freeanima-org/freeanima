import { describe, expect, test } from "bun:test";

import { evaluateHealthAuthed } from "./health-auth.ts";

describe("health-auth", () => {
  test("evaluateHealthAuthed without token", async () => {
    const authed = await evaluateHealthAuthed(
      new Request("https://remote.example/rpc/v1/health/probe"),
    );
    expect(authed).toBe(false);
  });
});
