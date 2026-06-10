import { describe, expect, test } from "bun:test";

import { applyDeepSleepToolResult } from "./apply-tool-result.ts";
import { createEmptyChangeLog } from "./types.ts";

describe("applyDeepSleepToolResult", () => {
  test("records deprecate and merge changes", () => {
    const log = createEmptyChangeLog();

    applyDeepSleepToolResult(
      log,
      "memory_semantic_deprecate",
      JSON.stringify({ ok: true, semantic_memory_id: "f-000001" }),
    );
    expect(log.deprecatedIds).toEqual(["f-000001"]);

    applyDeepSleepToolResult(
      log,
      "memory_semantic_merge",
      JSON.stringify({
        ok: true,
        id: "f-000099",
        deprecated_ids: ["f-000010", "f-000011"],
      }),
    );
    expect(log.addedIds).toContain("f-000099");
    expect(log.deprecatedIds).toContain("f-000010");
    expect(log.deprecatedIds).toContain("f-000011");
  });

  test("ignores tool errors", () => {
    const log = createEmptyChangeLog();
    applyDeepSleepToolResult(log, "memory_semantic_create", JSON.stringify({ error: "fail" }));
    expect(log.addedIds).toHaveLength(0);
  });
});
