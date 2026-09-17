import { describe, expect, test } from "bun:test";

import { applyDeepSleepToolResult } from "./apply-tool-result.ts";
import { createEmptyChangeLog } from "./types.ts";

describe("applyDeepSleepToolResult", () => {
  test("records deprecate and merge changes", () => {
    const log = createEmptyChangeLog();

    applyDeepSleepToolResult(
      log,
      "memory_semantic_deprecate",
      JSON.stringify({ ok: true, semantic_memory_id: 1001 }),
    );
    expect(log.deprecatedIds).toEqual(["1001"]);

    applyDeepSleepToolResult(
      log,
      "memory_semantic_merge",
      JSON.stringify({
        ok: true,
        id: 1099,
        deprecated_ids: [1010, 1011],
      }),
    );
    expect(log.addedIds).toContain("1099");
    expect(log.deprecatedIds).toContain("1010");
    expect(log.deprecatedIds).toContain("1011");
  });

  test("ignores tool errors", () => {
    const log = createEmptyChangeLog();
    applyDeepSleepToolResult(log, "memory_semantic_create", JSON.stringify({ error: "fail" }));
    expect(log.addedIds).toHaveLength(0);
  });
});
