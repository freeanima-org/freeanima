import type { SapAttachOutput } from "./frames/lifecycle.ts";
import type { SapToolDefInput, ToolCallPayload } from "./frames/tool.ts";
import type { SapInstanceStore } from "./instance-store.ts";
import type { SapClient } from "./router.ts";
import {
  runHabitatRpcTransport,
  type HabitatRpcTransportHandle,
} from "@freeanima/shared/habitat-rpc";
import {
  attachHubEventFanout,
  createSapRelayServerState,
  type SapRelayServerState,
} from "./satellite-relay-server.ts";
import { sapClientFromRpc } from "./sap-client-from-rpc.ts";
import { loadSapInstanceId } from "./instance-store.ts";

export type CreateSatelliteHubOptions = {
  appId: string;
  habitatUrl: string;
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
  reconnect(habitatUrl: string, httpUrl?: string): void;
  stop(): void;
  relayState: SapRelayServerState | null;
  getSapClient(): Promise<SapClient>;
};

function isStaleInstanceIdError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("unknown instance_id");
}

export function createSatelliteHabitatAttach(
  options: CreateSatelliteHubOptions,
): SatelliteHubHandle {
  let transport: HabitatRpcTransportHandle | null = null;
  let sapClient: SapClient | null = null;
  let instanceId: string | null = null;
  const relayState = options.relay ? createSapRelayServerState() : null;
  let currentHttpUrl = options.httpUrl;
  let currentHubUrl = options.habitatUrl;

  async function registerToolsAndHandlers(client: SapClient): Promise<void> {
    if (options.tools?.length) {
      client.onEvent("tool.call", (payload) => {
        void handleToolCall(client, payload as ToolCallPayload);
      });
      await client.request("tool.register", {
        tools: options.tools,
        private: options.toolsetPrivate !== false,
      });
    }
    if (relayState) {
      attachHubEventFanout(relayState, client);
    }
  }

  async function handleToolCall(client: SapClient, payload: ToolCallPayload): Promise<void> {
    if (!options.onToolCall) {
      await client.request("tool.error", {
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
      await client.request("tool.result", { call_id: payload.call_id, content });
    } catch (e) {
      await client.request("tool.error", {
        call_id: payload.call_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function sapAttach(client: SapClient, instanceIdHint?: string): Promise<string> {
    const attachBase = {
      app_id: options.appId,
      features_requested: options.featuresRequested ?? ["server_info", "capability_mask"],
      ...(currentHttpUrl ? { http_url: currentHttpUrl } : {}),
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const attached = (await client.request("sap.attach", {
          ...attachBase,
          ...(instanceIdHint ? { instance_id: instanceIdHint } : {}),
        })) as SapAttachOutput;
        return attached.instance_id;
      } catch (e) {
        if (attempt === 0 && instanceIdHint && isStaleInstanceIdError(e)) {
          instanceIdHint = undefined;
          continue;
        }
        throw e;
      }
    }
    throw new Error("sap.attach failed");
  }

  function startTransport(habitatUrl: string, httpUrl?: string): HabitatRpcTransportHandle {
    transport?.stop();
    currentHubUrl = habitatUrl;
    currentHttpUrl = httpUrl ?? currentHttpUrl;
    const authToken = options.remoteAuthToken?.trim();
    if (!authToken) {
      throw new Error("satellite hub requires remoteAuthToken");
    }

    transport = runHabitatRpcTransport({
      habitatUrl: currentHubUrl,
      authToken,
      onConnected: async (rpc) => {
        const client = sapClientFromRpc(rpc);
        const storedId = (await loadSapInstanceId(options.instanceStore)) ?? undefined;
        const attachedId = await sapAttach(client, storedId);
        instanceId = attachedId;
        void options.instanceStore?.save(attachedId);
        sapClient = client;
        await registerToolsAndHandlers(client);
        await options.onConnected?.(client, attachedId);
      },
    });
    return transport;
  }

  if (!transport) {
    startTransport(options.habitatUrl, options.httpUrl);
  }

  return {
    getInstanceId(): string | null {
      return instanceId;
    },
    isConnected(): boolean {
      return sapClient != null;
    },
    whenConnected(): Promise<SapClient> {
      if (!transport) {
        return Promise.reject(new Error("SAP transport not started"));
      }
      return transport.whenConnected().then((rpc) => sapClient ?? sapClientFromRpc(rpc));
    },
    reconnect(habitatUrl: string, httpUrl?: string): void {
      sapClient = null;
      instanceId = null;
      startTransport(habitatUrl, httpUrl);
    },
    stop(): void {
      transport?.stop();
      transport = null;
      sapClient = null;
    },
    relayState,
    getSapClient(): Promise<SapClient> {
      return this.whenConnected();
    },
  };
}

/** @deprecated 0.9.3 后删除 — 请用 createSatelliteHabitatAttach */
export const createSatelliteHub = createSatelliteHabitatAttach;
