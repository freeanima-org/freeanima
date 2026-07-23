import { describe, expect, it } from "bun:test";
import { ToolSetRegistry, toolError } from "@freeanima/core/tool";
import { formatRemoteToolName } from "@freeanima/shared/rpc-contract";
import { RemoteToolsManager } from "@freeanima/capabilities/remote-tools";

describe("sap strict routing integration", () => {
  it("does not fall back to habitat-local file_read for mismatched sap tool", () => {
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

    const sapName = formatRemoteToolName("companion", "a1b", "file_read");
    const route = manager.resolveToolCall("sid", sapName, {
      outpost_app_id: "companion",
      outpost_instance_id: "c2d",
    });
    expect(route.kind).toBe("reject");

    const guard = registry.getTool(sapName);
    expect(guard).toBeDefined();
    const result = guard!.handler({});
    expect(result).toContain("sap tool not registered");
    expect(result).not.toBe("habitat executed");

    const localTool = registry.getTool("file_read");
    expect(localTool?.handler({})).toBe("habitat executed");
  });

  it("returns toolError content for reject route", async () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    const name = formatRemoteToolName("companion", "k7m", "x");
    const out = await manager.callToolViaSatellite("sid", name, {}, undefined);
    expect(out).toBe(toolError("session has no outpost binding; remote tools forbidden"));
  });
});
