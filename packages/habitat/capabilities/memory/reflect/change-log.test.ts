import { describe, expect, test } from "bun:test";

import { formatChangeLogMessage } from "./change-log.ts";
import { createEmptyChangeLog, type DeepSleepChangeLog } from "./types.ts";

describe("formatChangeLogMessage", () => {
  test("空 log 返回占位", () => {
    expect(formatChangeLogMessage(createEmptyChangeLog())).toBe(
      "(No changes applied yet in this deep sleep run)",
    );
  });

  test("穷举 action 分段输出", () => {
    const log: DeepSleepChangeLog = {
      entries: {
        a: {
          action: "deprecated",
          id: "a",
          detail: "stale",
        },
        b: {
          action: "modified",
          id: "b",
          detail: "rewritten",
        },
        c: {
          action: "added",
          id: "c",
          detail: "new",
          mergedTarget: {
            id: "c",
            type: "observation",
            content: "fact",
            source_conversations: ["s1"],
            observed_at: "2026-08-19T01:02:03.000Z",
          },
        },
        d: {
          action: "merged_into",
          id: "d",
          detail: "merged into c",
          mergedTarget: {
            id: "c",
            type: "observation",
            content: "fact",
            source_conversations: [],
            observed_at: null,
          },
        },
      },
      addedIds: ["c"],
      modifiedIds: ["b"],
      deprecatedIds: ["a", "d"],
    };
    const text = formatChangeLogMessage(log);
    expect(text).toContain("# Incremental changes");
    expect(text).toContain("a — expired/deprecated (stale)");
    expect(text).toContain("d — merged → c (observation)");
    expect(text).toContain("b — modified: rewritten");
    expect(text).toContain('c (observation) "fact"');
  });
});
