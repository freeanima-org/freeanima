import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { mergeSessionToolNames, resolveExecutableToolNames } from "./session-tools.ts";
import type { SessionMetaMessage } from "@freeanima/core/db/domain";

function testRegistry(): ToolSetRegistry {
  const reg = new ToolSetRegistry();
  reg.registerToolSet("toolset", "discovery", [
    {
      name: "toolset_search",
      description: "search",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
    {
      name: "toolset_load",
      description: "load",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  reg.registerToolSet("memory", "memory", [
    {
      name: "memory_recall",
      description: "recall",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  reg.registerToolSet("file", "file", [
    {
      name: "file_read",
      description: "read",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  return reg;
}

describe("mergeSessionToolNames", () => {
  it("dedupes and merges", () => {
    expect(mergeSessionToolNames(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("resolveExecutableToolNames", () => {
  it("expands cached and staged toolsets", () => {
    const meta = {
      role: "session_meta",
      model: "m",
      cached_toolsets: ["toolset", "memory"],
      staged_toolsets: ["file"],
      functions: [],
      timestamp: "",
    } satisfies SessionMetaMessage;
    const names = resolveExecutableToolNames(meta, testRegistry()).toSorted();
    expect(names).toEqual(
      ["file_read", "memory_recall", "toolset_load", "toolset_search"].toSorted(),
    );
  });
});
