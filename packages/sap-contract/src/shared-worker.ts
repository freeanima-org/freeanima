import type { SapClient, SapMethod, SapRouterInputs, SapRouterOutputs } from "./router.ts";
import type { ConnectPayload, ConnectedPayload } from "./frames/lifecycle.ts";
import type { SapReconnectPolicy } from "./transport.ts";
import { sapInstanceStoreFromKey } from "./instance-store.ts";

/** postMessage-safe init payload (no functions / AbortSignal) */
export type SapSharedWorkerInitConfig = {
  hubUrl: string;
  connect: Omit<ConnectPayload, "protocol">;
  reconnect?: SapReconnectPolicy | false;
  /** localStorage key; worker reconstructs browser instance store */
  instanceStoreKey?: string;
};

export type SharedWorkerPortMessage =
  | { type: "init"; config: SapSharedWorkerInitConfig }
  | { type: "subscribe_evt"; method: string }
  | { type: "req"; id: string; method: SapMethod; payload: unknown }
  | { type: "res"; id: string; ok: true; payload: unknown }
  | { type: "res"; id: string; ok: false; error: string }
  | { type: "evt"; method: string; payload: unknown }
  | { type: "state"; connected: boolean; instanceId: string | null };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type WorkerConfig = SapSharedWorkerInitConfig;

/** Runs inside SharedWorker: one Hub transport shared across browser tabs */
export function installSapSharedWorkerHost(): void {
  const scope = self as unknown as { onconnect: ((ev: MessageEvent) => void) | null };

  let transport: import("./transport.ts").SapTransportHandle | null = null;
  let workerConfig: WorkerConfig | null = null;
  let instanceId: string | null = null;
  const ports = new Set<MessagePort>();
  const subscribedMethods = new Set<string>();

  const broadcast = (msg: SharedWorkerPortMessage): void => {
    for (const port of ports) {
      try {
        port.postMessage(msg);
      } catch {
        /* port may be detached */
      }
    }
  };

  const wireEventForwarding = (client: SapClient): void => {
    for (const method of subscribedMethods) {
      client.onEvent(method, (payload) => {
        broadcast({ type: "evt", method, payload });
      });
    }
  };

  const ensureTransport = async (): Promise<SapClient> => {
    if (!workerConfig) throw new Error("SAP shared worker not initialized");
    if (transport?.getClient()) return transport.whenConnected();
    const { runSapTransport } = await import("./transport.ts");
    const { instanceStoreKey, ...transportConfig } = workerConfig;
    transport = runSapTransport({
      ...transportConfig,
      instanceStore: instanceStoreKey ? sapInstanceStoreFromKey(instanceStoreKey) : undefined,
      onConnected: async (client, connected) => {
        instanceId = connected.instance_id;
        wireEventForwarding(client);
        broadcast({ type: "state", connected: true, instanceId });
      },
      onDisconnected: () => {
        broadcast({ type: "state", connected: false, instanceId });
      },
    });
    const client = await transport.whenConnected();
    wireEventForwarding(client);
    return client;
  };

  scope.onconnect = (ev: MessageEvent): void => {
    const port = (ev as MessageEvent & { ports: MessagePort[] }).ports[0];
    if (!port) return;
    ports.add(port);
    port.start();
    port.postMessage({
      type: "state",
      connected: transport?.getClient() !== null,
      instanceId,
    } satisfies SharedWorkerPortMessage);

    port.onmessage = (messageEv: MessageEvent<SharedWorkerPortMessage>): void => {
      const msg = messageEv.data;
      if (msg.type === "init") {
        workerConfig = msg.config;
        void ensureTransport().catch(() => {
          broadcast({ type: "state", connected: false, instanceId: null });
        });
        return;
      }
      if (msg.type === "subscribe_evt") {
        subscribedMethods.add(msg.method);
        const client = transport?.getClient();
        if (client) {
          client.onEvent(msg.method, (payload) => {
            broadcast({ type: "evt", method: msg.method, payload });
          });
        }
        return;
      }
      if (msg.type === "req") {
        void (async () => {
          try {
            const client = await ensureTransport();
            const result = await client.request(
              msg.method,
              msg.payload as SapRouterInputs[typeof msg.method],
            );
            port.postMessage({ type: "res", id: msg.id, ok: true, payload: result });
          } catch (e) {
            port.postMessage({
              type: "res",
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        })();
      }
    };
  };
}

export type CreateSharedWorkerSapClientOptions = {
  worker: SharedWorker;
  initConfig: WorkerConfig;
};

export function createSharedWorkerSapClient(
  options: CreateSharedWorkerSapClientOptions,
): SapClient & { getInstanceId(): string | null } {
  const port = options.worker.port;
  port.start();
  const pending = new Map<string, Pending>();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  let instanceId: string | null = null;
  let initSent = false;

  const ensureInit = (): void => {
    if (initSent) return;
    initSent = true;
    port.postMessage({
      type: "init",
      config: options.initConfig,
    } satisfies SharedWorkerPortMessage);
  };

  port.onmessage = (ev: MessageEvent<SharedWorkerPortMessage>): void => {
    const msg = ev.data;
    if (msg.type === "state") {
      instanceId = msg.instanceId;
      return;
    }
    if (msg.type === "res") {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.payload);
      else entry.reject(new Error(msg.error));
      return;
    }
    if (msg.type === "evt") {
      const handlers = eventHandlers.get(msg.method);
      if (!handlers) return;
      for (const handler of handlers) handler(msg.payload);
    }
  };

  ensureInit();

  return {
    getInstanceId(): string | null {
      return instanceId;
    },
    async connect(_payload: Omit<ConnectPayload, "protocol">): Promise<ConnectedPayload> {
      ensureInit();
      if (!instanceId) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("SAP shared worker connect timeout")),
            30_000,
          );
          const onState = (ev: MessageEvent<SharedWorkerPortMessage>): void => {
            if (ev.data.type === "state" && ev.data.instanceId) {
              instanceId = ev.data.instanceId;
              clearTimeout(timer);
              port.removeEventListener("message", onState as EventListener);
              resolve();
            }
          };
          port.addEventListener("message", onState as EventListener);
        });
      }
      return {
        protocol: "SAP/1.0",
        instance_id: instanceId!,
        features_enabled: [],
        heartbeat_interval_sec: 30,
      };
    },
    request<K extends SapMethod>(
      method: K,
      payload: SapRouterInputs[K],
    ): Promise<SapRouterOutputs[K]> {
      ensureInit();
      const id = crypto.randomUUID();
      return new Promise<SapRouterOutputs[K]>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        port.postMessage({ type: "req", id, method, payload } satisfies SharedWorkerPortMessage);
      });
    },
    onEvent(method: string, handler: (payload: unknown) => void): () => void {
      let set = eventHandlers.get(method);
      if (!set) {
        set = new Set();
        eventHandlers.set(method, set);
        port.postMessage({ type: "subscribe_evt", method } satisfies SharedWorkerPortMessage);
      }
      set.add(handler);
      return () => set?.delete(handler);
    },
    close(): void {
      port.close();
    },
  };
}
