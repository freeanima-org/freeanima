import { describe, expect, it } from "bun:test";
import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import {
  filterHabitatLocalHandsForCoding,
  isCodingConversationMeta,
  isHabitatLocalHandTool,
} from "./coding-local-hands.ts";

function meta(partial?: Partial<ConversationMetaMessage>): ConversationMetaMessage {
  return {
    model: "test",
    cached_toolsets: [],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    ...partial,
  };
}

describe("isHabitatLocalHandTool", () => {
  it("matches habitat file_* and shell tools", () => {
    expect(isHabitatLocalHandTool("file_read")).toBe(true);
    expect(isHabitatLocalHandTool("file_search")).toBe(true);
    expect(isHabitatLocalHandTool("terminal_run")).toBe(true);
    expect(isHabitatLocalHandTool("terminal_process")).toBe(true);
    expect(isHabitatLocalHandTool("code_execute")).toBe(true);
  });

  it("keeps outpost / mcp / other tools", () => {
    expect(isHabitatLocalHandTool("remote_coding_abc_file_read")).toBe(false);
    expect(isHabitatLocalHandTool("remote_coding_abc_terminal_run")).toBe(false);
    expect(isHabitatLocalHandTool("mcp_fs_read")).toBe(false);
    expect(isHabitatLocalHandTool("memory_semantic_search")).toBe(false);
    expect(isHabitatLocalHandTool("toolset_load")).toBe(false);
  });
});

describe("filterHabitatLocalHandsForCoding", () => {
  const names = [
    "file_read",
    "terminal_run",
    "code_execute",
    "memory_semantic_search",
    "remote_coding_1_file_read",
    "toolset_load",
  ];

  it("is identity for chat / digital_human", () => {
    expect(filterHabitatLocalHandsForCoding(names, meta({ platform: "chat" }))).toEqual(names);
    expect(isCodingConversationMeta(meta({ platform: "chat" }))).toBe(false);
  });

  it("strips habitat local hands for coding_agent / platform=coding", () => {
    const byScenario = filterHabitatLocalHandsForCoding(names, meta({ scenario: "coding_agent" }));
    expect(byScenario).toEqual([
      "memory_semantic_search",
      "remote_coding_1_file_read",
      "toolset_load",
    ]);
    const byPlatform = filterHabitatLocalHandsForCoding(names, meta({ platform: "coding" }));
    expect(byPlatform).toEqual(byScenario);
  });
});
