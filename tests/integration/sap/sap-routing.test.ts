import { describe, expect, it } from "bun:test";
import { ToolSetRegistry, toolError } from "@freeanima/core/tool";
import { formatSapToolName } from "@freeanima/sap-contract";
import { SatelliteManager } from "@freeanima/capabilities-satellite";

describe("sap strict routing integration", () => {
  it("does not fall back to hub file_read_file for mismatched sap tool", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("file", "file", [
      {
        name: "file_read_file",
        description: "hub local",
        parameters: { type: "object", properties: {} },
        handler: () => "hub executed",
      },
    ]);

    const manager = new SatelliteManager(registry);
    manager.installToolRouting();

    const sapName = formatSapToolName(
      "pair-programming",
      "550e8400-e29b-41d4-a716-446655440000",
      "file_read_file",
    );
    const route = manager.resolveToolCall("sid", sapName, {
      satellite_app_id: "pairprogramming",
      satellite_instance_id: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(route.kind).toBe("reject");

    const guard = registry.getTool(sapName);
    expect(guard).toBeDefined();
    const result = guard!.handler({});
    expect(result).toContain("sap tool not registered");
    expect(result).not.toBe("hub executed");

    const hub = registry.getTool("file_read_file");
    expect(hub?.handler({})).toBe("hub executed");
  });

  it("returns toolError content for reject route", async () => {
    const manager = new SatelliteManager(new ToolSetRegistry());
    const name = formatSapToolName("pair-programming", "550e8400-e29b-41d4-a716-446655440000", "x");
    const out = await manager.callToolViaSatellite("sid", name, {}, undefined);
    expect(out).toBe(toolError("session has no satellite binding; sap tools forbidden"));
  });
});
