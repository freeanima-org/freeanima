import type { RemoteToolsAttachOutput } from "./frames/lifecycle.ts";
import type { RemoteToolDefInput, ToolCallPayload } from "./frames/tool.ts";
import type { RemoteInstanceStore } from "./instance-store.ts";
import type { RpcStreamClient } from "./router.ts";
import {
  runHabitatRpcTransport,
  type HabitatRpcTransportHandle,
} from "@freeanima/shared/habitat-rpc";
import { sapClientFromRpc } from "./rpc-stream-client-from-rpc.ts";
import { loadRemoteInstanceId } from "./instance-store.ts";

export type CreateRemoteToolsAttachOptions = {
  appId: string;
  habitatUrl: string;
  httpUrl?: string;
  instanceStore?: RemoteInstanceStore;
  featuresRequested?: string[];
  tools?: RemoteToolDefInput[];
  toolsetPrivate?: boolean;
  onToolCall?: (
    localName: string,
    args: Record<string, unknown>,
    ctx: { workspace_root?: string },
  ) => Promise<string>;
  onConnected?: (client: RpcStreamClient, instanceId: string) => void | Promise<void>;
  remoteAuthToken?: string;
};

export type RemoteToolsAttachHandle = {
  getInstanceId(): string | null;
  isConnected(): boolean;
  whenConnected(): Promise<RpcStreamClient>;
  reconnect(habitatUrl: string, httpUrl?: string): void;
  stop(): void;
  getRpcStreamClient(): Promise<RpcStreamClient>;
};

function isStaleInstanceIdError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("unknown instance_id");
}

/** Habitat RPC remote-tool host: connect, remote_tools.attach, optional tool.register. */
export function createRemoteToolsHabitatAttach(
  options: CreateRemoteToolsAttachOptions,
): RemoteToolsAttachHandle {
  let transport: HabitatRpcTransportHandle | null = null;
  let streamClient: RpcStreamClient | null = null;
  let instanceId: string | null = null;
  let currentHttpUrl = options.httpUrl;
  let currentHubUrl = options.habitatUrl;

  async function registerToolsAndHandlers(client: RpcStreamClient): Promise<void> {
    if (!options.tools?.length) return;
    client.onEvent("tool.call", (payload) => {
      void handleToolCall(client, payload as ToolCallPayload);
    });
    await client.request("tool.register", {
      tools: options.tools,
      private: options.toolsetPrivate !== false,
    });
  }

  async function handleToolCall(client: RpcStreamClient, payload: ToolCallPayload): Promise<void> {
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

  async function attachRemoteTools(
    client: RpcStreamClient,
    instanceIdHint?: string,
  ): Promise<string> {
    const attachBase = {
      app_id: options.appId,
      features_requested: options.featuresRequested ?? ["server_info", "capability_mask"],
      ...(currentHttpUrl ? { http_url: currentHttpUrl } : {}),
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const attached = (await client.request("remote_tools.attach", {
          ...attachBase,
          ...(instanceIdHint ? { instance_id: instanceIdHint } : {}),
        })) as RemoteToolsAttachOutput;
        return attached.instance_id;
      } catch (e) {
        if (attempt === 0 && instanceIdHint && isStaleInstanceIdError(e)) {
          instanceIdHint = undefined;
          continue;
        }
        throw e;
      }
    }
    throw new Error("remote_tools.attach failed");
  }

  function startTransport(habitatUrl: string, httpUrl?: string): HabitatRpcTransportHandle {
    transport?.stop();
    currentHubUrl = habitatUrl;
    currentHttpUrl = httpUrl ?? currentHttpUrl;
    const authToken = options.remoteAuthToken?.trim();
    if (!authToken) {
      throw new Error("remote tools attach requires remoteAuthToken");
    }

    transport = runHabitatRpcTransport({
      habitatUrl: currentHubUrl,
      authToken,
      onConnected: async (rpc) => {
        const client = sapClientFromRpc(rpc);
        const storedId = (await loadRemoteInstanceId(options.instanceStore)) ?? undefined;
        const attachedId = await attachRemoteTools(client, storedId);
        instanceId = attachedId;
        void options.instanceStore?.save(attachedId);
        streamClient = client;
        await registerToolsAndHandlers(client);
        await options.onConnected?.(client, attachedId);
      },
    });
    return transport;
  }

  startTransport(options.habitatUrl, options.httpUrl);

  return {
    getInstanceId(): string | null {
      return instanceId;
    },
    isConnected(): boolean {
      return streamClient != null;
    },
    whenConnected(): Promise<RpcStreamClient> {
      if (!transport) {
        return Promise.reject(new Error("Habitat RPC transport not started"));
      }
      return transport.whenConnected().then((rpc) => streamClient ?? sapClientFromRpc(rpc));
    },
    reconnect(habitatUrl: string, httpUrl?: string): void {
      streamClient = null;
      instanceId = null;
      startTransport(habitatUrl, httpUrl);
    },
    stop(): void {
      transport?.stop();
      transport = null;
      streamClient = null;
    },
    getRpcStreamClient(): Promise<RpcStreamClient> {
      return this.whenConnected();
    },
  };
}
