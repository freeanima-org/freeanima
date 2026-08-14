import { describe, expect, test } from "bun:test";

import { resolveMemoryCutoverFlags } from "./cutover.ts";

describe("memory cutover flags", () => {
  test("defaults: park on, sleep consolidation off (retain/reflect)", () => {
    expect(resolveMemoryCutoverFlags(null)).toEqual({
      disable_sleep_consolidation: true,
      park_limbic_dream_narrative: true,
    });
  });

  test("config can roll back", () => {
    expect(
      resolveMemoryCutoverFlags({
        memory: {
          cutover: {
            disable_sleep_consolidation: false,
            park_limbic_dream_narrative: false,
          },
        },
      }),
    ).toEqual({
      disable_sleep_consolidation: false,
      park_limbic_dream_narrative: false,
    });
  });
});
