import { randomUUID } from "node:crypto";
import type { JsonSchemaObject, ToolDef, ToolHandler, ToolSetRegistry } from "@freeanima/core/tool";
import { toolError, toolResult } from "@freeanima/core/tool";
import { omitUndefined } from "@freeanima/core/util";
import { getToolConversationId } from "@freeanima/core/tool/tool-context";
import {
  formatRemotePlatform,
  formatRemoteToolName,
  isRemotePrefixedToolName,
  normalizeAppSlug,
  normalizeInstanceId,
  parseRemoteToolName,
  remoteToolsetId,
  type RemoteToolDefInput,
  type ToolCallPayload,
} from "@freeanima/shared/rpc-contract";
import { logCapability as logComponent } from "@freeanima/core/config";

export type SatelliteConnection = {
  appId: string;
  instanceId: string;
  sendEvent: (method: string, payload: unknown) => void;
  sendRequest: (method: string, payload: unknown) => Promise<unknown>;
};

type PendingToolCall = {
  resolve: (content: string) => void;
  reject: (error: Error) => void;
};

type RegisteredSapTool = {
  fullName: string;
  localName: string;
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

export type SatelliteInstanceStatus = {
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

export type SatellitesStatusResponse = {
  instance_count: number;
  tool_count: number;
  instances: SatelliteInstanceStatus[];
};

const REMOTE_TOOL_CALL_TIMEOUT_MS = 60_000;

export class RemoteToolsManager {
  private readonly connections = new Map<string, SatelliteConnection>();
  private readonly instanceMeta = new Map<string, InstanceMeta>();
  private readonly toolIndex = new Map<string, RegisteredSapTool>();
  private readonly pendingCalls = new Map<string, PendingToolCall>();
  private readonly toolSetNames = new Map<string, string>();
  private readonly registeredToolDefs = new Map<string, RemoteToolDefInput[]>();
  private readonly registeredToolPrivate = new Map<string, boolean>();
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
        description: "SAP satellite tool guard",
        parameters: { type: "object", properties: {} },
        handler: () => this.rejectUnregisteredSapTool(name),
      };
    };
  }

  registerConnection(key: string, conn: SatelliteConnection, opts?: { httpUrl?: string }): void {
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

  getStatus(): SatellitesStatusResponse {
    const instances: SatelliteInstanceStatus[] = [];
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
    opts?: { private?: boolean },
  ): string[] {
    const appSlug = normalizeAppSlug(appId);
    const instanceNorm = normalizeInstanceId(instanceId);
    const setName = remoteToolsetId(appId, instanceId);
    this.unregisterToolSet(setName);

    const registered: string[] = [];
    const defs: ToolDef[] = [];

    for (const tool of tools) {
      const fullName = formatRemoteToolName(appId, instanceId, tool.local_name);
      const handler: ToolHandler = (args) => this.invokeRegisteredTool(fullName, args);
      defs.push({
        name: fullName,
        description: tool.description,
        parameters: tool.parameters as JsonSchemaObject,
        returnKind: tool.return_kind,
        handler,
      });
      this.toolIndex.set(fullName, {
        fullName,
        localName: tool.local_name,
        appSlug,
        instanceNorm,
      });
      registered.push(fullName);
    }

    const key = this.connectionKey(appId, instanceId);
    this.registeredToolDefs.set(key, tools);
    this.registeredToolPrivate.set(key, opts?.private !== false);

    if (defs.length > 0) {
      this.toolSets.registerToolSet(setName, `SAP satellite ${appId}/${instanceId}`, defs, {
        private: opts?.private !== false,
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
    const isPrivate = this.registeredToolPrivate.get(key) ?? true;
    this.unregisterAllTools(appId, instanceId);
    if (next.length > 0) {
      this.registerTools(appId, instanceId, next, { private: isPrivate });
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
    this.registeredToolPrivate.delete(key);
  }

  resolveToolCall(
    conversationId: string,
    name: string,
    platformExtra: Record<string, unknown> | undefined,
  ):
    | { kind: "hub_local" }
    | { kind: "reject"; error: string }
    | { kind: "satellite_proxy"; payload: ToolCallPayload } {
    if (!isRemotePrefixedToolName(name)) {
      return { kind: "hub_local" };
    }

    const parsed = parseRemoteToolName(name);
    if (!parsed.ok) {
      return { kind: "reject", error: `invalid sap tool name: ${name}` };
    }

    const satelliteAppId = platformExtra?.satellite_app_id;
    const satelliteInstanceId = platformExtra?.satellite_instance_id;
    if (typeof satelliteAppId !== "string" || typeof satelliteInstanceId !== "string") {
      return { kind: "reject", error: "session has no satellite binding; sap tools forbidden" };
    }

    const expectedApp = normalizeAppSlug(satelliteAppId);
    const expectedInst = normalizeInstanceId(satelliteInstanceId);
    if (parsed.value.app_slug !== expectedApp || parsed.value.instance_id_norm !== expectedInst) {
      return {
        kind: "reject",
        error: `sap tool binding mismatch: tool=${name} session=${expectedApp}/${expectedInst}`,
      };
    }

    if (!this.isInstanceConnected(expectedApp, expectedInst)) {
      return {
        kind: "reject",
        error: `satellite instance offline: ${expectedApp}/${expectedInst}`,
      };
    }

    if (!this.hasRegisteredTool(parsed.value.canonical)) {
      return { kind: "reject", error: `sap tool not registered: ${name}` };
    }

    const workspaceRoot =
      typeof platformExtra?.workspace_root === "string" ? platformExtra.workspace_root : undefined;

    return {
      kind: "satellite_proxy",
      payload: {
        call_id: randomUUID(),
        tool_name: parsed.value.canonical,
        local_name: parsed.value.local_name,
        args: {},
        conversation_id: conversationId,
        workspace_root: workspaceRoot,
      },
    };
  }

  async callToolViaSatellite(
    conversationId: string,
    name: string,
    args: Record<string, unknown>,
    platformExtra: Record<string, unknown> | undefined,
  ): Promise<string> {
    const route = this.resolveToolCall(conversationId, name, platformExtra);
    if (route.kind === "hub_local") {
      throw new Error(`expected sap tool, got hub_local: ${name}`);
    }
    if (route.kind === "reject") {
      return toolError(route.error);
    }

    const appSlug = normalizeAppSlug(String(platformExtra?.satellite_app_id ?? ""));
    const instanceNorm = normalizeInstanceId(String(platformExtra?.satellite_instance_id ?? ""));
    const conn = this.connections.get(`${appSlug}:${instanceNorm}`);
    if (!conn) {
      return toolError(`satellite instance offline: ${appSlug}/${instanceNorm}`);
    }

    const payload: ToolCallPayload = { ...route.payload, args };
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

  private async invokeRegisteredTool(
    fullName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const conversationId = getToolConversationId() ?? "";
    if (!conversationId) {
      return toolError("sap tool requires active conversation context");
    }

    const meta = await this.loadSessionPlatformExtra(conversationId);
    const route = this.resolveToolCall(conversationId, fullName, meta);
    if (route.kind === "reject") {
      return toolError(route.error);
    }
    if (route.kind === "hub_local") {
      return toolError(`unexpected hub_local for sap tool: ${fullName}`);
    }

    return this.callToolViaSatellite(conversationId, fullName, args, meta);
  }

  private rejectUnregisteredSapTool(name: string): string {
    const conversationId = getToolConversationId() ?? "";
    logComponent("satellite").warn("reject unregistered sap tool", { name, conversationId });
    return toolError(`sap tool not registered: ${name}`);
  }

  /** Injected by platform composition root */
  loadSessionPlatformExtra: (
    conversationId: string,
  ) => Promise<Record<string, unknown> | undefined> = async () => {};
}

export { toolResult };
