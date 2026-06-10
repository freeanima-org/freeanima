import { describe, expect, it } from "bun:test";
import { mergeSessionToolNames, resolveExecutableToolNames } from "./session-tools.ts";
import type { SessionMetaMessage } from "./message.ts";

describe("mergeSessionToolNames", () => {
  it("dedupes and merges", () => {
    expect(mergeSessionToolNames(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("resolveExecutableToolNames", () => {
  it("merges tools and loaded_tools", () => {
    const meta = {
      role: "session_meta",
      model: "m",
      tools: ["tools_list", "memory_recall"],
      loaded_tools: ["file_read_file"],
      functions: [],
      timestamp: "",
    } satisfies SessionMetaMessage;
    expect(resolveExecutableToolNames(meta).toSorted()).toEqual(
      ["file_read_file", "memory_recall", "tools_list"].toSorted(),
    );
  });
});
