import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { formatRemoteToolName, normalizeAppSlug } from "@freeanima/shared/rpc-contract";
import { RemoteToolsManager } from "./manager.ts";

describe("RemoteToolsManager routing", () => {
  const appId = "pair-programming";
  const instanceA = "a1b";
  const instanceB = "c2d";

  it("routes by tool name when conversation has no outpost binding", () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    const name = formatRemoteToolName(appId, instanceA, "scan_code");
    manager.registerConnection(manager.connectionKey(appId, instanceA), {
      appId,
      instanceId: instanceA,
      sendEvent: () => {},
      sendRequest: async () => ({}),
    });
    manager.registerTools(appId, instanceA, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);

    const route = manager.resolveToolCall("sid", name, undefined);
    expect(route.kind).toBe("outpost_proxy");
    if (route.kind === "outpost_proxy") {
      expect(route.appSlug).toBe(normalizeAppSlug(appId));
      expect(route.instanceNorm).toBe(instanceA);
    }
  });

  it("rejects when target instance is offline even without binding", () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    const name = formatRemoteToolName(appId, instanceA, "scan_code");
    const route = manager.resolveToolCall("sid", name, undefined);
    expect(route.kind).toBe("reject");
    if (route.kind === "reject") {
      expect(route.error).toContain("outpost instance offline");
    }
  });

  it("allows cross-conversation call when session binding differs from tool instance", () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    manager.registerConnection(manager.connectionKey(appId, instanceB), {
      appId,
      instanceId: instanceB,
      sendEvent: () => {},
      sendRequest: async () => ({}),
    });
    manager.registerTools(appId, instanceB, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);
    const toolName = formatRemoteToolName(appId, instanceB, "scan_code");
    const route = manager.resolveToolCall("sid", toolName, {
      outpost_app_id: "pairprogramming",
      outpost_instance_id: instanceA,
    });
    expect(route.kind).toBe("outpost_proxy");
    if (route.kind === "outpost_proxy") {
      expect(route.instanceNorm).toBe(instanceB);
    }
  });

  it("allows habitat_local for non-sap tools", () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    expect(manager.resolveToolCall("sid", "toolset_search", {}).kind).toBe("habitat_local");
  });

  it("reports connected instance status and tools", () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
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
    expect(status.instances[0]?.platform).toBe("remote:pairprogramming:k7m");
    expect(status.instances[0]?.tools).toEqual([
      formatRemoteToolName(appId, instanceId, "scan_code"),
    ]);
    expect(status.instances[0]?.last_heartbeat_at).not.toBeNull();
  });
});
