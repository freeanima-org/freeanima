import { describe, expect, it } from "bun:test";
import { ToolSetRegistry, toolError } from "@freeanima/core/tool";
import { formatSapToolName } from "@freeanima/shared/sap-contract";
import { SatelliteManager } from "@freeanima/capabilities/satellite";

describe("sap strict routing integration", () => {
  it("does not fall back to hub file_read for mismatched sap tool", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("file", "file", [
      {
        name: "file_read",
        description: "hub local",
        parameters: { type: "object", properties: {} },
        handler: () => "hub executed",
      },
    ]);

    const manager = new SatelliteManager(registry);
    manager.installToolRouting();

    const sapName = formatSapToolName("companion", "a1b", "file_read");
    const route = manager.resolveToolCall("sid", sapName, {
      satellite_app_id: "companion",
      satellite_instance_id: "c2d",
    });
    expect(route.kind).toBe("reject");

    const guard = registry.getTool(sapName);
    expect(guard).toBeDefined();
    const result = guard!.handler({});
    expect(result).toContain("sap tool not registered");
    expect(result).not.toBe("hub executed");

    const hub = registry.getTool("file_read");
    expect(hub?.handler({})).toBe("hub executed");
  });

  it("returns toolError content for reject route", async () => {
    const manager = new SatelliteManager(new ToolSetRegistry());
    const name = formatSapToolName("companion", "k7m", "x");
    const out = await manager.callToolViaSatellite("sid", name, {}, undefined);
    expect(out).toBe(toolError("session has no satellite binding; sap tools forbidden"));
  });
});
