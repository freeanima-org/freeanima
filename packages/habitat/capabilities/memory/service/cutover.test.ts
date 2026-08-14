import { describe, expect, test } from "bun:test";

import { resolveMemoryCutoverFlags } from "./cutover.ts";

describe("memory cutover flags", () => {
  test("defaults: park on", () => {
    expect(resolveMemoryCutoverFlags(null)).toEqual({
      park_limbic_dream_narrative: true,
    });
  });

  test("config can roll back park", () => {
    expect(
      resolveMemoryCutoverFlags({
        memory: {
          cutover: {
            park_limbic_dream_narrative: false,
          },
        },
      }),
    ).toEqual({
      park_limbic_dream_narrative: false,
    });
  });
});
