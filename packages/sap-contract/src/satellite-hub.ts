import type { SapToolDefInput, ToolCallPayload } from "./frames/tool.ts";
import type { SapInstanceStore } from "./instance-store.ts";
import type { SapClient } from "./router.ts";
import { runSapTransport, type SapTransportHandle } from "./transport.ts";
import {
  attachHubEventFanout,
  createSapRelayServerState,
  type SapRelayServerState,
} from "./satellite-relay-server.ts";

export type CreateSatelliteHubOptions = {
  appId: string;
  hubUrl: string;
  httpUrl?: string;
  instanceStore?: SapInstanceStore;
  featuresRequested?: string[];
  relay?: boolean;
  tools?: SapToolDefInput[];
  toolsetPrivate?: boolean;
  onToolCall?: (
    localName: string,
    args: Record<string, unknown>,
    ctx: { workspace_root?: string },
  ) => Promise<string>;
  onConnected?: (client: SapClient, instanceId: string) => void | Promise<void>;
  remoteAuthToken?: string;
};

export type SatelliteHubHandle = {
  getInstanceId(): string | null;
  isConnected(): boolean;
  whenConnected(): Promise<SapClient>;
  reconnect(hubUrl: string, httpUrl?: string): void;
  stop(): void;
  relayState: SapRelayServerState | null;
  getSapClient(): Promise<SapClient>;
};

export function createSatelliteHub(options: CreateSatelliteHubOptions): SatelliteHubHandle {
  let transport: SapTransportHandle | null = null;
  let instanceId: string | null = null;
  const relayState = options.relay ? createSapRelayServerState() : null;
  let currentHttpUrl = options.httpUrl;

  async function registerToolsAndHandlers(sap: SapClient): Promise<void> {
    if (options.tools?.length) {
      sap.onEvent("tool.call", (payload) => {
        void handleToolCall(sap, payload as ToolCallPayload);
      });
      await sap.request("tool.register", {
        tools: options.tools,
        private: options.toolsetPrivate !== false,
      });
    }
    if (relayState) {
      attachHubEventFanout(relayState, sap);
    }
  }

  async function handleToolCall(sap: SapClient, payload: ToolCallPayload): Promise<void> {
    if (!options.onToolCall) {
      await sap.request("tool.error", {
        call_id: payload.call_id,
        error: "no local tool executor configured",
      });
      return;
    }
    try {
      const content = await options.onToolCall(
        payload.local_name,
        payload.args,
        payload.workspace_root !== undefined ? { workspace_root: payload.workspace_root } : {},
      );
      await sap.request("tool.result", { call_id: payload.call_id, content });
    } catch (e) {
      await sap.request("tool.error", {
        call_id: payload.call_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function startTransport(hubUrl: string, httpUrl?: string): SapTransportHandle {
    transport?.stop();
    currentHttpUrl = httpUrl ?? currentHttpUrl;

    transport = runSapTransport({
      hubUrl,
      ...(options.instanceStore !== undefined ? { instanceStore: options.instanceStore } : {}),
      connect: {
        app_id: options.appId,
        features_requested: options.featuresRequested ?? ["server_info", "capability_mask"],
        ...(currentHttpUrl ? { http_url: currentHttpUrl } : {}),
        ...(options.remoteAuthToken ? { auth_token: options.remoteAuthToken } : {}),
      },
      onConnected: async (sap, connected) => {
        instanceId = connected.instance_id;
        options.instanceStore?.save(connected.instance_id);
        await registerToolsAndHandlers(sap);
        await options.onConnected?.(sap, connected.instance_id);
      },
    });
    return transport;
  }

  if (!transport) {
    startTransport(options.hubUrl, options.httpUrl);
  }

  return {
    getInstanceId(): string | null {
      return instanceId;
    },
    isConnected(): boolean {
      return transport?.getClient() != null;
    },
    whenConnected(): Promise<SapClient> {
      return transport!.whenConnected();
    },
    reconnect(hubUrl: string, httpUrl?: string): void {
      startTransport(hubUrl, httpUrl);
    },
    stop(): void {
      transport?.stop();
      transport = null;
    },
    relayState,
    getSapClient(): Promise<SapClient> {
      return transport!.whenConnected();
    },
  };
}
