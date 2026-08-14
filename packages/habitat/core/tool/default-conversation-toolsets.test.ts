import { describe, expect, it, afterEach } from "bun:test";
import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import {
  filterToolSetsByAllowedTools,
  resolveDefaultConversationToolSets,
  resolveDefaultConversationToolSetsForMeta,
} from "./default-conversation-toolsets.ts";
import {
  applyConversationToolPolicyFilter,
  registerConversationToolPolicyFilter,
} from "./policy-port.ts";
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
    registry.registerToolSet("memory", "memory", [stubTool("memory_semantic_search")]);
    registry.registerToolSet("file", "file", [stubTool("file_read")]);
    const filtered = filterToolSetsByAllowedTools(
      registry,
      ["memory", "file"],
      ["memory_semantic_search"],
    );
    expect(filtered).toEqual(["memory"]);
  });
});

describe("resolveDefaultConversationToolSetsForMeta", () => {
  afterEach(() => {
    registerConversationToolPolicyFilter((names) => names);
  });

  it("returns only default toolsets present in registry", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_semantic_search")]);
    expect(resolveDefaultConversationToolSets(registry)).toEqual(["memory"]);
  });

  it("returns registry defaults when no mask filter applies", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_semantic_search")]);
    const resolved = resolveDefaultConversationToolSetsForMeta(registry, metaFixture());
    expect(resolved).toEqual(resolveDefaultConversationToolSets(registry));
  });

  it("applies conversation tool policy filter when registered", () => {
    registerConversationToolPolicyFilter((names) => names.filter((n) => n.startsWith("memory_")));
    const registry = new ToolSetRegistry();
    registry.registerToolSet("toolset", "discovery", [
      stubTool("toolset_search"),
      stubTool("toolset_load"),
    ]);
    registry.registerToolSet("memory", "memory", [stubTool("memory_semantic_search")]);
    registry.registerToolSet("conversation", "session", [stubTool("conversation_search")]);
    const resolved = resolveDefaultConversationToolSetsForMeta(registry, metaFixture());
    expect(resolved).toEqual(["memory"]);
    expect(applyConversationToolPolicyFilter(["memory_semantic_search"], metaFixture())).toEqual([
      "memory_semantic_search",
    ]);
  });
});
