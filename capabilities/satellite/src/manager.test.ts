import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { formatSapToolName } from "@freeanima/sap-contract";
import { SatelliteManager } from "./manager.ts";

describe("SatelliteManager routing", () => {
  const appId = "pair-programming";
  const instanceA = "a1b";
  const instanceB = "c2d";

  it("rejects sap tools when conversation has no satellite binding", () => {
    const manager = new SatelliteManager(new ToolSetRegistry());
    const name = formatSapToolName(appId, instanceA, "scan_code");
    const route = manager.resolveToolCall("sid", name, undefined);
    expect(route.kind).toBe("reject");
  });

  it("rejects sap tool instance mismatch", () => {
    const manager = new SatelliteManager(new ToolSetRegistry());
    manager.registerTools(appId, instanceB, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);
    const wrongName = formatSapToolName(appId, instanceB, "scan_code");
    const route = manager.resolveToolCall("sid", wrongName, {
      satellite_app_id: "pairprogramming",
      satellite_instance_id: instanceA,
    });
    expect(route.kind).toBe("reject");
    if (route.kind === "reject") {
      expect(route.error).toContain("binding mismatch");
    }
  });

  it("allows hub_local for non-sap tools", () => {
    const manager = new SatelliteManager(new ToolSetRegistry());
    expect(manager.resolveToolCall("sid", "toolset_search", {}).kind).toBe("hub_local");
  });

  it("reports connected instance status and tools", () => {
    const manager = new SatelliteManager(new ToolSetRegistry());
    const instanceId = "k7m";
    const key = manager.connectionKey(appId, instanceId);
    manager.registerConnection(key, {
      appId,
      instanceId,
      sendEvent: () => {},
      sendRequest: async () => ({}),
    });
    manager.registerTools(appId, instanceId, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);
    manager.touchHeartbeat(appId, instanceId);

    const status = manager.getStatus();
    expect(status.instance_count).toBe(1);
    expect(status.tool_count).toBe(1);
    expect(status.instances[0]?.app_id).toBe(appId);
    expect(status.instances[0]?.platform).toBe("sap:pairprogramming:k7m");
    expect(status.instances[0]?.tools).toEqual([formatSapToolName(appId, instanceId, "scan_code")]);
    expect(status.instances[0]?.last_heartbeat_at).not.toBeNull();
  });
});
