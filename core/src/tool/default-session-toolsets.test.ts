import { describe, expect, it, afterEach } from "bun:test";
import type { SessionMetaMessage } from "@freeanima/core/db/domain";
import {
  filterToolsetsByAllowedTools,
  resolveDefaultSessionToolsets,
  resolveDefaultSessionToolsetsForMeta,
} from "./default-session-toolsets.ts";
import { applySessionToolMaskFilter, registerSessionToolMaskFilter } from "./mask-port.ts";
import { ToolSetRegistry } from "./toolset.ts";

function stubTool(name: string) {
  return {
    name,
    description: name,
    parameters: { type: "object", properties: {} },
    handler: () => "ok",
  };
}

function metaFixture(partial?: Partial<SessionMetaMessage>): SessionMetaMessage {
  return {
    role: "session_meta",
    model: "test",
    cached_toolsets: [],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    ...partial,
  };
}

describe("filterToolsetsByAllowedTools", () => {
  it("keeps toolsets with at least one allowed tool", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    registry.registerToolSet("file", "file", [stubTool("file_read_file")]);
    const filtered = filterToolsetsByAllowedTools(registry, ["memory", "file"], ["memory_recall"]);
    expect(filtered).toEqual(["memory"]);
  });
});

describe("resolveDefaultSessionToolsetsForMeta", () => {
  afterEach(() => {
    registerSessionToolMaskFilter((names) => names);
  });

  it("returns only default toolsets present in registry", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    expect(resolveDefaultSessionToolsets(registry)).toEqual(["memory"]);
  });

  it("returns registry defaults when no mask filter applies", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    const resolved = resolveDefaultSessionToolsetsForMeta(registry, metaFixture());
    expect(resolved).toEqual(resolveDefaultSessionToolsets(registry));
  });

  it("filters defaults to toolsets allowed by capability mask", () => {
    registerSessionToolMaskFilter((names) => names.filter((n) => n.startsWith("memory_")));
    const registry = new ToolSetRegistry();
    registry.registerToolSet("toolsets", "discovery", [
      stubTool("toolsets_search"),
      stubTool("toolsets_load"),
    ]);
    registry.registerToolSet("memory", "memory", [stubTool("memory_recall")]);
    registry.registerToolSet("sessions", "sessions", [stubTool("sessions_list")]);
    const resolved = resolveDefaultSessionToolsetsForMeta(
      registry,
      metaFixture({ capability_mask: { presets: ["sleep"] } }),
    );
    expect(resolved).toEqual(["memory"]);
    expect(applySessionToolMaskFilter(["memory_recall"], metaFixture())).toEqual(["memory_recall"]);
  });
});
