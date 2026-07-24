import { describe, expect, it, afterEach } from "bun:test";
import type { ConversationMetaMessage } from "@freeanima/host/core/db/domain";
import {
  filterToolSetsByAllowedTools,
  resolveDefaultConversationToolSets,
  resolveDefaultConversationToolSetsForMeta,
} from "./default-conversation-toolsets.ts";
import {
  applyConversationToolMaskFilter,
  registerConversationToolMaskFilter,
} from "./mask-port.ts";
import { ToolSetRegistry } from "./toolset.ts";

function stubTool(name: string) {
  return {
    name,
    description: name,
    parameters: { type: "object", properties: {} },
    handler: () => "ok",
  };
}

function metaFixture(partial?: Partial<ConversationMetaMessage>): ConversationMetaMessage {
  return {
    role: "conversation_meta",
    model: "test",
    cached_toolsets: [],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    ...partial,
  };
}

describe("filterToolSetsByAllowedTools", () => {
  it("keeps toolsets with at least one allowed tool", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    registry.registerToolSet("file", "file", [stubTool("file_read")]);
    const filtered = filterToolSetsByAllowedTools(registry, ["memory", "file"], ["memory_recall"]);
    expect(filtered).toEqual(["memory"]);
  });
});

describe("resolveDefaultConversationToolSetsForMeta", () => {
  afterEach(() => {
    registerConversationToolMaskFilter((names) => names);
  });

  it("returns only default toolsets present in registry", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    expect(resolveDefaultConversationToolSets(registry)).toEqual(["memory"]);
  });

  it("returns registry defaults when no mask filter applies", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    const resolved = resolveDefaultConversationToolSetsForMeta(registry, metaFixture());
    expect(resolved).toEqual(resolveDefaultConversationToolSets(registry));
  });

  it("filters defaults to toolsets allowed by capability mask", () => {
    registerConversationToolMaskFilter((names) => names.filter((n) => n.startsWith("memory_")));
    const registry = new ToolSetRegistry();
    registry.registerToolSet("toolset", "discovery", [
      stubTool("toolset_search"),
      stubTool("toolset_load"),
    ]);
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    registry.registerToolSet("conversation", "session", [stubTool("conversation_search")]);
    const resolved = resolveDefaultConversationToolSetsForMeta(
      registry,
      metaFixture({ capability_mask: { presets: ["sleep"] } }),
    );
    expect(resolved).toEqual(["memory"]);
    expect(applyConversationToolMaskFilter(["memory_recall"], metaFixture())).toEqual([
      "memory_recall",
    ]);
  });
});
