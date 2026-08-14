import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import * as pg from "@freeanima/habitat/core/db/pg";
import { ToolSetRegistry } from "./toolset.ts";
import { unloadToolSetsFromConversation } from "./conversation-tools.ts";

const patchConversationMetaMock = mock(async () => {});

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  patchConversationMeta: patchConversationMetaMock,
}));

function testRegistry(): ToolSetRegistry {
  const reg = new ToolSetRegistry();
  reg.registerToolSet("toolset", "discovery", [
    {
      name: "toolset_load",
      description: "load",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
    {
      name: "toolset_unload",
      description: "unload",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  reg.registerToolSet("memory", "memory", [
    {
      name: "memory_semantic_search",
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
  reg.registerToolSet("ops", "ops", [
    {
      name: "ops_status",
      description: "status",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  return reg;
}

describe("unloadToolSetsFromConversation", () => {
  let pgSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    pgSpy = spyOn(pg, "isPostgresPrimary").mockReturnValue(true);
    patchConversationMetaMock.mockClear();
  });

  afterEach(() => {
    pgSpy.mockRestore();
  });

  it("removes from staged and cached and reports revoked tools", async () => {
    const meta = {
      model: "m",
      cached_toolsets: ["toolset", "memory", "file"],
      staged_toolsets: ["ops"],
      functions: [],
      timestamp: "",
    } satisfies ConversationMetaMessage;

    const result = await unloadToolSetsFromConversation(
      testRegistry(),
      "sess-1",
      ["file", "ops"],
      meta,
    );

    expect(result.unloaded.toSorted()).toEqual(["file", "ops"]);
    expect(result.protected).toEqual([]);
    expect(result.not_loaded).toEqual([]);
    expect(result.unknown).toEqual([]);
    expect(result.revoked_tools.toSorted()).toEqual(["file_read", "ops_status"]);
    expect(patchConversationMetaMock).toHaveBeenCalledWith("sess-1", {
      cached_toolsets: ["toolset", "memory"],
      staged_toolsets: [],
    });
  });

  it("protects default ToolSets and reports not_loaded / unknown", async () => {
    const meta = {
      model: "m",
      cached_toolsets: ["toolset", "memory"],
      staged_toolsets: [],
      functions: [],
      timestamp: "",
    } satisfies ConversationMetaMessage;

    const result = await unloadToolSetsFromConversation(
      testRegistry(),
      "sess-1",
      ["memory", "file", "missing"],
      meta,
    );

    expect(result.unloaded).toEqual([]);
    expect(result.protected).toEqual(["memory"]);
    expect(result.not_loaded).toEqual(["file"]);
    expect(result.unknown).toEqual(["missing"]);
    expect(result.revoked_tools).toEqual([]);
    expect(patchConversationMetaMock).not.toHaveBeenCalled();
  });
});
