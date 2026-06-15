import type { JsonSchemaObject, ToolDef, ToolHandler, ToolSetRegistry } from "@freeanima/core/tool";
import { toolError, toolResult } from "@freeanima/core/tool";
import { getToolSessionId } from "@freeanima/core/tool/tool-context";
import {
  formatSapToolName,
  isSapPrefixedToolName,
  normalizeAppSlug,
  normalizeInstanceId,
  parseSapToolName,
  resolvePlatformForApp,
  sapToolsetId,
  type SapToolDefInput,
  type ToolCallPayload,
} from "@freeanima/sap-contract";
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
};

export type SatelliteInstanceStatus = {
  app_id: string;
  app_slug: string;
  instance_id: string;
  instance_id_norm: string;
  platform: string | null;
  connected_at: string;
  last_heartbeat_at: string | null;
  tool_count: number;
  tools: string[];
};

export type SatellitesStatusResponse = {
  instance_count: number;
  tool_count: number;
  instances: SatelliteInstanceStatus[];
};

export class SatelliteManager {
  private readonly connections = new Map<string, SatelliteConnection>();
  private readonly instanceMeta = new Map<string, InstanceMeta>();
  private readonly toolIndex = new Map<string, RegisteredSapTool>();
  private readonly pendingCalls = new Map<string, PendingToolCall>();
  private readonly toolSetNames = new Map<string, string>();
  private wrappedGetTool: ((name: string) => ToolDef | undefined) | null = null;

  constructor(private readonly toolSets: ToolSetRegistry) {}

  installToolRouting(): void {
    if (this.wrappedGetTool) return;
    const original = this.toolSets.getTool.bind(this.toolSets);
    this.wrappedGetTool = original;
    this.toolSets.getTool = (name: string) => {
      if (!isSapPrefixedToolName(name)) {
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

  registerConnection(key: string, conn: SatelliteConnection): void {
    this.connections.set(key, conn);
    this.noteConnection(conn.appId, conn.instanceId);
  }

  unregisterConnection(key: string): void {
    const conn = this.connections.get(key);
    if (!conn) return;
    this.unregisterAllTools(conn.appId, conn.instanceId);
    this.connections.delete(key);
    this.instanceMeta.delete(key);
  }

  noteConnection(appId: string, instanceId: string): void {
    const key = this.connectionKey(appId, instanceId);
    this.instanceMeta.set(key, {
      appId,
      instanceId,
      connectedAt: new Date().toISOString(),
      lastHeartbeatAt: null,
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
        .sort();
      toolCount += tools.length;
      instances.push({
        app_id: conn.appId,
        app_slug: appSlug,
        instance_id: conn.instanceId,
        instance_id_norm: instanceNorm,
        platform: resolvePlatformForApp(conn.appId) ?? null,
        connected_at: meta?.connectedAt ?? new Date(0).toISOString(),
        last_heartbeat_at: meta?.lastHeartbeatAt ?? null,
        tool_count: tools.length,
        tools,
      });
    }

    instances.sort(
      (a, b) => a.app_id.localeCompare(b.app_id) || a.instance_id.localeCompare(b.instance_id),
    );

    return {
      instance_count: instances.length,
      tool_count: toolCount,
      instances,
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

  registerTools(appId: string, instanceId: string, tools: SapToolDefInput[]): string[] {
    const appSlug = normalizeAppSlug(appId);
    const instanceNorm = normalizeInstanceId(instanceId);
    const setName = sapToolsetId(appId, instanceId);
    this.unregisterToolSet(setName);

    const registered: string[] = [];
    const defs: ToolDef[] = [];

    for (const tool of tools) {
      const fullName = formatSapToolName(appId, instanceId, tool.local_name);
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

    if (defs.length > 0) {
      this.toolSets.registerToolSet(setName, `SAP satellite ${appId}/${instanceId}`, defs);
      this.toolSetNames.set(setName, setName);
    }
    return registered;
  }

  unregisterTools(appId: string, instanceId: string, localNames?: string[]): void {
    if (!localNames || localNames.length === 0) {
      this.unregisterAllTools(appId, instanceId);
      return;
    }
    const setName = sapToolsetId(appId, instanceId);
    for (const localName of localNames) {
      const fullName = formatSapToolName(appId, instanceId, localName);
      this.toolIndex.delete(fullName);
    }
    this.unregisterToolSet(setName);
    const remaining = [...this.toolIndex.values()].filter(
      (t) =>
        t.appSlug === normalizeAppSlug(appId) && t.instanceNorm === normalizeInstanceId(instanceId),
    );
    if (remaining.length > 0) {
      // re-register remaining — simplified: full re-register not kept; unregister all then noop
      this.unregisterAllTools(appId, instanceId);
    }
  }

  unregisterAllTools(appId: string, instanceId: string): void {
    const setName = sapToolsetId(appId, instanceId);
    const removed = this.toolSets.unregisterToolSet(setName);
    for (const name of removed) {
      this.toolIndex.delete(name);
    }
    this.toolSetNames.delete(setName);
  }

  resolveToolCall(
    sessionId: string,
    name: string,
    platformExtra: Record<string, unknown> | undefined,
  ):
    | { kind: "hub_local" }
    | { kind: "reject"; error: string }
    | { kind: "satellite_proxy"; payload: ToolCallPayload } {
    if (!isSapPrefixedToolName(name)) {
      return { kind: "hub_local" };
    }

    const parsed = parseSapToolName(name);
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
        call_id: crypto.randomUUID(),
        tool_name: parsed.value.canonical,
        local_name: parsed.value.local_name,
        args: {},
        session_id: sessionId,
        workspace_root: workspaceRoot,
      },
    };
  }

  async callToolViaSatellite(
    sessionId: string,
    name: string,
    args: Record<string, unknown>,
    platformExtra: Record<string, unknown> | undefined,
  ): Promise<string> {
    const route = this.resolveToolCall(sessionId, name, platformExtra);
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
      this.pendingCalls.set(payload.call_id, { resolve, reject });
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
    const sessionId = getToolSessionId() ?? "";
    if (!sessionId) {
      return toolError("sap tool requires active session context");
    }

    const meta = await this.loadSessionPlatformExtra(sessionId);
    const route = this.resolveToolCall(sessionId, fullName, meta);
    if (route.kind === "reject") {
      return toolError(route.error);
    }
    if (route.kind === "hub_local") {
      return toolError(`unexpected hub_local for sap tool: ${fullName}`);
    }

    return this.callToolViaSatellite(sessionId, fullName, args, meta);
  }

  private rejectUnregisteredSapTool(name: string): string {
    const sessionId = getToolSessionId() ?? "";
    logComponent("satellite").warn("reject unregistered sap tool", { name, sessionId });
    return toolError(`sap tool not registered: ${name}`);
  }

  /** Injected by platform composition root */
  loadSessionPlatformExtra: (sessionId: string) => Promise<Record<string, unknown> | undefined> =
    async () => undefined;
}

export function wrapSapToolHandler(
  manager: SatelliteManager,
  originalHandler: ToolHandler,
  fullName: string,
): ToolHandler {
  return async (args) => {
    const sessionId = getToolSessionId() ?? "";
    const meta = await manager.loadSessionPlatformExtra(sessionId);
    const route = manager.resolveToolCall(sessionId, fullName, meta);
    if (route.kind === "reject") {
      return toolError(route.error);
    }
    if (route.kind === "satellite_proxy") {
      return manager.callToolViaSatellite(sessionId, fullName, args, meta);
    }
    return originalHandler(args);
  };
}

export { toolResult };
