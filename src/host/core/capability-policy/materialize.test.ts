import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import {
  materializeToolNames,
  POLICY_RUN_HARD_DENIED_TOOLS,
  resolveSubagentToolPolicy,
} from "./materialize.ts";

function registry(): ToolSetRegistry {
  const reg = new ToolSetRegistry();
  reg.registerToolSet("memory", "memory", [
    {
      name: "memory_semantic_search",
      description: "r",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
    {
      name: "memory_remember",
      description: "w",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  reg.registerToolSet("toolset", "discovery", [
    {
      name: "toolset_load",
      description: "l",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
    {
      name: "toolset_search",
      description: "s",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  reg.registerToolSet("file", "file", [
    {
      name: "file_read",
      description: "r",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
    {
      name: "file_write",
      description: "w",
      parameters: { type: "object", properties: {} },
      handler: async () => "{}",
    },
  ]);
  return reg;
}

describe("resolveSubagentToolPolicy / materializeToolNames", () => {
  it("empty allow yields no tools", () => {
    const policy = resolveSubagentToolPolicy({ entityAllowed: [], entityDenied: [] }, registry());
    expect(materializeToolNames(policy)).toEqual([]);
  });

  it("expands @ToolSet and applies deny", () => {
    const policy = resolveSubagentToolPolicy(
      {
        entityAllowed: ["@memory", "file_read"],
        entityDenied: ["memory_remember"],
      },
      registry(),
    );
    expect(materializeToolNames(policy)).toEqual(["file_read", "memory_semantic_search"]);
  });

  it("HARD_DENY strips toolset_* even if allowed", () => {
    const policy = resolveSubagentToolPolicy(
      {
        entityAllowed: ["toolset_load", "toolset_search", "file_read"],
        entityDenied: [],
      },
      registry(),
    );
    const names = materializeToolNames(policy);
    expect(names).toEqual(["file_read"]);
    for (const t of POLICY_RUN_HARD_DENIED_TOOLS) {
      expect(names.includes(t)).toBe(false);
    }
  });

  it("skill deny narrows but skill allow cannot expand entity ceiling", () => {
    const policy = resolveSubagentToolPolicy(
      {
        entityAllowed: ["file_read"],
        entityDenied: [],
        skillDenies: ["file_read"],
      },
      registry(),
    );
    expect(materializeToolNames(policy)).toEqual([]);

    const policy2 = resolveSubagentToolPolicy(
      {
        entityAllowed: ["file_read"],
        entityDenied: [],
        // skill would want memory — ignored (not in entity allow)
      },
      registry(),
    );
    expect(materializeToolNames(policy2)).toEqual(["file_read"]);
  });

  it("extra hardDeny removes subagent tools", () => {
    const policy = resolveSubagentToolPolicy(
      {
        entityAllowed: ["file_read", "subagent_run"],
        entityDenied: [],
        hardDeny: ["subagent_run"],
      },
      registry(),
    );
    expect(materializeToolNames(policy, ["subagent_run"])).toEqual(["file_read"]);
  });
});
