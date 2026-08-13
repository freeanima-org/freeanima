import { randomUUID } from "node:crypto";
import type {
  ToolDef,
  ToolHandler,
  ToolSetRegistry,
  ToolSetVisibility,
} from "@freeanima/host/core/tool";
import { resolveToolSetVisibility, toolError, toolResult } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";
import { getToolConversationId } from "@freeanima/host/core/tool/tool-context";
import {
  formatRemotePlatform,
  formatRemoteToolName,
  isRemotePrefixedToolName,
  normalizeAppSlug,
  normalizeInstanceId,
  remoteToolsetId,
  type RemoteToolDefInput,
  type ToolCallPayload,
} from "@freeanima/shared/rpc-contract";
import { logCapability as logComponent } from "@freeanima/host/core/config/capability-injection";

export type OutpostConnection = {
  appId: string;
  instanceId: string;
  sendEvent: (method: string, payload: unknown) => void;
  sendRequest: (method: string, payload: unknown) => Promise<unknown>;
};

type PendingToolCall = {
  resolve: (content: string) => void;
  reject: (error: Error) => void;
};

type RegisteredOutpostTool = {
  fullName: string;
  localName: string;
  connectionKey: string;
  appSlug: string;
  instanceNorm: string;
};

type InstanceMeta = {
  appId: string;
  instanceId: string;
  connectedAt: string;
  lastHeartbeatAt: string | null;
  httpUrl: string | null;
};

export type OutpostInstanceStatus = {
  app_id: string;
  app_slug: string;
  instance_id: string;
  instance_id_norm: string;
  platform: string | null;
  connected_at: string;
  last_heartbeat_at: string | null;
  http_url: string | null;
  tool_count: number;
  tools: string[];
};

export type OutpostsStatusResponse = {
  instance_count: number;
  tool_count: number;
  instances: OutpostInstanceStatus[];
};

const REMOTE_TOOL_CALL_TIMEOUT_MS = 60_000;

export class RemoteToolsManager {
  private readonly connections = new Map<string, OutpostConnection>();
  private readonly instanceMeta = new Map<string, InstanceMeta>();
  private readonly toolIndex = new Map<string, RegisteredOutpostTool>();
  private readonly pendingCalls = new Map<string, PendingToolCall>();
  private readonly toolSetNames = new Map<string, string>();
  private readonly registeredToolDefs = new Map<string, RemoteToolDefInput[]>();
  private readonly registeredToolVisibility = new Map<string, ToolSetVisibility>();
  private wrappedGetTool: ((name: string) => ToolDef | undefined) | null = null;

  constructor(private readonly toolSets: ToolSetRegistry) {}

  installToolRouting(): void {
    if (this.wrappedGetTool) return;
    const original = this.toolSets.getTool.bind(this.toolSets);
    this.wrappedGetTool = original;
    this.toolSets.getTool = (name: string) => {
      if (!isRemotePrefixedToolName(name)) {
        return original(name);
      }
      const existing = original(name);
      if (existing) return existing;
      return {
        name,
        description: "Outpost remote-tool guard",
        parameters: { type: "object", properties: {} },
        handler: () => this.rejectUnregisteredSapTool(name),
      };
    };
  }

  registerConnection(key: string, conn: OutpostConnection, opts?: { httpUrl?: string }): void {
    this.connections.set(key, conn);
    this.noteConnection(conn.appId, conn.instanceId, omitUndefined({ httpUrl: opts?.httpUrl }));
  }

  unregisterConnection(key: string): void {
    const conn = this.connections.get(key);
    if (!conn) return;
    this.unregisterAllTools(conn.appId, conn.instanceId);
    this.connections.delete(key);
    this.instanceMeta.delete(key);
  }

  noteConnection(
    appId: string,
    instanceId: string,
    opts?: { httpUrl?: string; instance_label?: string },
  ): void {
    const key = this.connectionKey(appId, instanceId);
    const prev = this.instanceMeta.get(key);
    this.instanceMeta.set(key, {
      appId,
      instanceId,
      connectedAt: prev?.connectedAt ?? new Date().toISOString(),
      lastHeartbeatAt: prev?.lastHeartbeatAt ?? null,
      httpUrl: opts?.httpUrl ?? prev?.httpUrl ?? null,
    });
  }

  touchHeartbeat(appId: string, instanceId: string): void {
    const key = this.connectionKey(appId, instanceId);
    const meta = this.instanceMeta.get(key);
    if (!meta) return;
    meta.lastHeartbeatAt = new Date().toISOString();
  }

  getStatus(): OutpostsStatusResponse {
    const instances: OutpostInstanceStatus[] = [];
    let toolCount = 0;

    for (const [key, conn] of this.connections) {
      const meta = this.instanceMeta.get(key);
      const appSlug = normalizeAppSlug(conn.appId);
      const instanceNorm = normalizeInstanceId(conn.instanceId);
      const tools = [...this.toolIndex.values()]
        .filter((t) => t.appSlug === appSlug && t.instanceNorm === instanceNorm)
        .map((t) => t.fullName)
        .toSorted();
      toolCount += tools.length;
      instances.push({
        app_id: conn.appId,
        app_slug: appSlug,
        instance_id: conn.instanceId,
        instance_id_norm: instanceNorm,
        platform: formatRemotePlatform(conn.appId, conn.instanceId),
        connected_at: meta?.connectedAt ?? new Date(0).toISOString(),
        last_heartbeat_at: meta?.lastHeartbeatAt ?? null,
        http_url: meta?.httpUrl ?? null,
        tool_count: tools.length,
        tools,
      });
    }

    return {
      instance_count: instances.length,
      tool_count: toolCount,
      instances: instances.toSorted(
        (a, b) => a.app_id.localeCompare(b.app_id) || a.instance_id.localeCompare(b.instance_id),
      ),
    };
  }

  connectionKey(appId: string, instanceId: string): string {
    return `${normalizeAppSlug(appId)}:${normalizeInstanceId(instanceId)}`;
  }

  isInstanceConnected(appSlug: string, instanceNorm: string): boolean {
    return this.connections.has(`${appSlug}:${instanceNorm}`);
  }

  hasRegisteredTool(name: string): boolean {
    return this.toolIndex.has(name);
  }

  registerTools(
    appId: string,
    instanceId: string,
    tools: RemoteToolDefInput[],
    opts?: { visibility?: ToolSetVisibility; private?: boolean },
  ): string[] {
    const key = this.connectionKey(appId, instanceId);
    if (!this.connections.has(key)) {
      logComponent("outpost").warn("registerTools skipped: no connection", {
        appId,
        instanceId,
      });
      return [];
    }

    const appSlug = normalizeAppSlug(appId);
    const instanceNorm = normalizeInstanceId(instanceId);
    const setName = remoteToolsetId(appId, instanceId);
    this.unregisterToolSet(setName);

    const registered: string[] = [];
    const defs: ToolDef[] = [];

    for (const tool of tools) {
      const fullName = formatRemoteToolName(appId, instanceId, tool.local_name);
      const localName = tool.local_name;
      const handler: ToolHandler = (args) => this.dispatchBoundTool(key, fullName, localName, args);
      defs.push({
        name: fullName,
        description: tool.description,
        parameters: tool.parameters,
        returnKind: tool.return_kind,
        handler,
      });
      this.toolIndex.set(fullName, {
        fullName,
        localName,
        connectionKey: key,
        appSlug,
        instanceNorm,
      });
      registered.push(fullName);
    }

    const visibility = resolveToolSetVisibility(opts);
    this.registeredToolDefs.set(key, tools);
    this.registeredToolVisibility.set(key, visibility);

    if (defs.length > 0) {
      this.toolSets.registerToolSet(setName, `Outpost ${appId}/${instanceId}`, defs, {
        visibility,
      });
      this.toolSetNames.set(setName, setName);
    }
    return registered;
  }

  unregisterTools(appId: string, instanceId: string, localNames?: string[]): void {
    if (!localNames || localNames.length === 0) {
      this.unregisterAllTools(appId, instanceId);
      return;
    }
    const key = this.connectionKey(appId, instanceId);
    const current = this.registeredToolDefs.get(key) ?? [];
    const remove = new Set(localNames.map((n) => n.trim()).filter(Boolean));
    const next = current.filter((t) => !remove.has(t.local_name));
    const visibility = this.registeredToolVisibility.get(key) ?? "catalog";
    this.unregisterAllTools(appId, instanceId);
    if (next.length > 0) {
      this.registerTools(appId, instanceId, next, { visibility });
    }
  }

  unregisterAllTools(appId: string, instanceId: string): void {
    const setName = remoteToolsetId(appId, instanceId);
    const key = this.connectionKey(appId, instanceId);
    const removed = this.toolSets.unregisterToolSet(setName);
    for (const name of removed) {
      this.toolIndex.delete(name);
    }
    this.toolSetNames.delete(setName);
    this.registeredToolDefs.delete(key);
    this.registeredToolVisibility.delete(key);
  }

  handleToolResult(callId: string, content: string): void {
    const pending = this.pendingCalls.get(callId);
    if (!pending) return;
    this.pendingCalls.delete(callId);
    pending.resolve(content);
  }

  handleToolError(callId: string, error: string): void {
    const pending = this.pendingCalls.get(callId);
    if (!pending) return;
    this.pendingCalls.delete(callId);
    pending.resolve(toolError(error));
  }

  private unregisterToolSet(setName: string): void {
    if (!this.toolSetNames.has(setName)) return;
    const removed = this.toolSets.unregisterToolSet(setName);
    for (const name of removed) {
      this.toolIndex.delete(name);
    }
    this.toolSetNames.delete(setName);
  }

  /** 注册时绑定的通道；调用只查 live connection，不做工具名/会话二次路由 */
  private async dispatchBoundTool(
    connectionKey: string,
    fullName: string,
    localName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const conversationId = getToolConversationId() ?? "";
    if (!conversationId) {
      return toolError("sap tool requires active conversation context");
    }

    const conn = this.connections.get(connectionKey);
    if (!conn) {
      return toolError(`outpost instance offline: ${connectionKey}`);
    }

    const meta = await this.loadSessionPlatformExtra(conversationId);
    const workspaceRoot =
      typeof meta?.workspace_root === "string" ? meta.workspace_root : undefined;

    const payload: ToolCallPayload = omitUndefined({
      call_id: randomUUID(),
      tool_name: fullName,
      local_name: localName,
      args,
      conversation_id: conversationId,
      workspace_root: workspaceRoot,
    });

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pendingCalls.has(payload.call_id)) return;
        this.pendingCalls.delete(payload.call_id);
        resolve(toolError(`remote tool call timed out after ${REMOTE_TOOL_CALL_TIMEOUT_MS}ms`));
      }, REMOTE_TOOL_CALL_TIMEOUT_MS);

      this.pendingCalls.set(payload.call_id, {
        resolve: (content) => {
          clearTimeout(timer);
          resolve(content);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      conn.sendEvent("tool.call", payload);
    });
  }

  private rejectUnregisteredSapTool(name: string): string {
    const conversationId = getToolConversationId() ?? "";
    logComponent("outpost").warn("reject unregistered outpost tool", { name, conversationId });
    return toolError(`sap tool not registered: ${name}`);
  }

  /** 仅用于 payload.workspace_root；不参与路由。由 platform composition root 注入 */
  loadSessionPlatformExtra: (
    conversationId: string,
  ) => Promise<Record<string, unknown> | undefined> = async () => {};
}

export { toolResult };
