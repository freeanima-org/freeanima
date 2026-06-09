import { describe, expect, it } from "bun:test";
import { mergeSessionToolNames, resolveExecutableToolNames } from "./session-tools.ts";
import type { SessionMetaMessage } from "./message.ts";

describe("mergeSessionToolNames", () => {
  it("去重合并", () => {
    expect(mergeSessionToolNames(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("resolveExecutableToolNames", () => {
  it("合并 tools 与 loaded_tools", () => {
    const meta = {
      role: "session_meta",
      model: "m",
      tools: ["tool_search", "recall"],
      loaded_tools: ["read_file"],
      functions: [],
      timestamp: "",
    } satisfies SessionMetaMessage;
    expect(resolveExecutableToolNames(meta).toSorted()).toEqual(
      ["read_file", "recall", "tool_search"].toSorted(),
    );
  });
});
