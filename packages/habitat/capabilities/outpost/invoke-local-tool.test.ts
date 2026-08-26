import { describe, expect, it, mock } from "bun:test";

import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { RemoteToolsManager } from "./manager.ts";

describe("RemoteToolsManager.invokeLocalTool", () => {
  it("sends tool.call without conversation ALS", async () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    const events: Array<{ method: string; payload: unknown }> = [];
    manager.registerConnection("coding:inst1", {
      appId: "coding",
      instanceId: "inst1",
      sendEvent: (method, payload) => {
        events.push({ method, payload });
        const p = payload as { call_id: string };
        queueMicrotask(() => manager.handleToolResult(p.call_id, '{"ok":true}'));
      },
      sendRequest: mock(async () => ({})),
    });
    manager.registerTools("coding", "inst1", [
      {
        local_name: "file_list",
        description: "list",
        parameters: { type: "object", properties: {} },
        return_kind: "json",
      },
    ]);

    const content = await manager.invokeLocalTool({
      appId: "coding",
      instanceId: "inst1",
      localName: "file_list",
      args: { path: "." },
      workspaceRoot: "/repo",
    });
    expect(content).toBe('{"ok":true}');
    expect(events).toHaveLength(1);
    expect(events[0]?.method).toBe("tool.call");
    const payload = events[0]?.payload as {
      local_name: string;
      workspace_root?: string;
      conversation_id: string;
    };
    expect(payload.local_name).toBe("file_list");
    expect(payload.workspace_root).toBe("/repo");
    expect(payload.conversation_id).toBe("");
  });

  it("returns error when instance offline", async () => {
    const manager = new RemoteToolsManager(new ToolSetRegistry());
    const content = await manager.invokeLocalTool({
      appId: "coding",
      instanceId: "missing",
      localName: "file_list",
      args: {},
    });
    expect(content).toContain("offline");
  });
});
