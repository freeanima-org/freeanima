import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { runWithToolContext } from "@freeanima/habitat/core/tool/tool-context";
import { formatRemoteToolName } from "@freeanima/shared/rpc-contract";
import { RemoteToolsManager } from "./manager.ts";

describe("RemoteToolsManager bind-at-register", () => {
  const appId = "pair-programming";
  const instanceA = "a1b";
  const instanceB = "c2d";

  function stubConn(
    manager: RemoteToolsManager,
    instanceId: string,
    sendEvent: (method: string, payload: unknown) => void = () => {},
  ): void {
    manager.registerConnection(manager.connectionKey(appId, instanceId), {
      appId,
      instanceId,
      sendEvent,
      sendRequest: async () => ({}),
    });
  }

  it("dispatches tool.call on the connection bound at register", async () => {
    const registry = new ToolSetRegistry();
    const manager = new RemoteToolsManager(registry);
    const events: Array<{ method: string; payload: unknown }> = [];
    stubConn(manager, instanceA, (method, payload) => {
      events.push({ method, payload });
      const callId = (payload as { call_id: string }).call_id;
      manager.handleToolResult(callId, "ok");
    });
    manager.registerTools(appId, instanceA, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);

    const name = formatRemoteToolName(appId, instanceA, "scan_code");
    const tool = registry.getTool(name);
    expect(tool).toBeDefined();
    const result = await runWithToolContext("sid", () => tool!.handler({ path: "/tmp" }), {
      tools: registry,
    });
    expect(result).toBe("ok");
    expect(events).toHaveLength(1);
    expect(events[0]?.method).toBe("tool.call");
    const payload = events[0]?.payload as {
      tool_name: string;
      local_name: string;
      conversation_id: string;
      args: Record<string, unknown>;
    };
    expect(payload.tool_name).toBe(name);
    expect(payload.local_name).toBe("scan_code");
    expect(payload.conversation_id).toBe("sid");
    expect(payload.args).toEqual({ path: "/tmp" });
  });

  it("skips registerTools when instance has no connection", () => {
    const registry = new ToolSetRegistry();
    const manager = new RemoteToolsManager(registry);
    const registered = manager.registerTools(appId, instanceA, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);
    expect(registered).toEqual([]);
    expect(registry.getTool(formatRemoteToolName(appId, instanceA, "scan_code"))).toBeUndefined();
  });

  it("sends to the tool's bound instance even if another instance is also connected", async () => {
    const registry = new ToolSetRegistry();
    const manager = new RemoteToolsManager(registry);
    const targets: string[] = [];
    stubConn(manager, instanceA, (_method, payload) => {
      targets.push("A");
      manager.handleToolResult((payload as { call_id: string }).call_id, "from-A");
    });
    stubConn(manager, instanceB, (_method, payload) => {
      targets.push("B");
      manager.handleToolResult((payload as { call_id: string }).call_id, "from-B");
    });
    manager.registerTools(appId, instanceB, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);

    const name = formatRemoteToolName(appId, instanceB, "scan_code");
    const tool = registry.getTool(name)!;
    const result = await runWithToolContext("sid", () => tool.handler({}), { tools: registry });
    expect(result).toBe("from-B");
    expect(targets).toEqual(["B"]);
  });

  it("returns offline after connection unregister removes tools", async () => {
    const registry = new ToolSetRegistry();
    const manager = new RemoteToolsManager(registry);
    manager.installToolRouting();
    const key = manager.connectionKey(appId, instanceA);
    stubConn(manager, instanceA);
    manager.registerTools(appId, instanceA, [
      {
        local_name: "scan_code",
        description: "scan",
        parameters: { type: "object", properties: {} },
        return_kind: "text",
      },
    ]);
    const name = formatRemoteToolName(appId, instanceA, "scan_code");
    expect(registry.getTool(name)?.description).not.toBe("Outpost remote-tool guard");

    manager.unregisterConnection(key);
    const guard = registry.getTool(name);
    expect(guard?.description).toBe("Outpost remote-tool guard");
    const result = guard!.handler({});
    expect(result).toContain("sap tool not registered");
  });

  it("reports connected instance status and tools", () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    const instanceId = "k7m";
    stubConn(manager, instanceId);
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
