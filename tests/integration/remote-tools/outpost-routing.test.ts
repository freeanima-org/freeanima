import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { formatRemoteToolName } from "@freeanima/shared/rpc-contract";
import { RemoteToolsManager } from "@freeanima/habitat/capabilities/outpost";

describe("outpost bind-at-register integration", () => {
  it("does not fall back to habitat-local file_read for unregistered remote tool", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("file", "file", [
      {
        name: "file_read",
        description: "habitat local",
        parameters: { type: "object", properties: {} },
        handler: () => "habitat executed",
      },
    ]);

    const manager = new RemoteToolsManager(registry);
    manager.installToolRouting();

    const remoteName = formatRemoteToolName("companion", "a1b", "file_read");
    const guard = registry.getTool(remoteName);
    expect(guard).toBeDefined();
    const result = guard!.handler({});
    expect(result).toContain("sap tool not registered");
    expect(result).not.toBe("habitat executed");

    const localTool = registry.getTool("file_read");
    expect(localTool?.handler({})).toBe("habitat executed");
  });

  it("does not register tools without a live connection", () => {
    const registry = new ToolSetRegistry();
    const manager = new RemoteToolsManager(registry);
    const name = formatRemoteToolName("companion", "k7m", "x");
    const registered = manager.registerTools("companion", "k7m", [
      {
        local_name: "x",
        description: "x",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);
    expect(registered).toEqual([]);
    expect(registry.getTool(name)).toBeUndefined();
  });
});
