import { describe, it, expect } from "bun:test";
import { runHubRpcTransport } from "@freeanima/hub-rpc";
import { HUB_RPC_VERSION, parseHubRpcEnvelope, serializeHubRpcEnvelope } from "@freeanima/hub-rpc";
import type { HubRpcEnvelope } from "@freeanima/hub-rpc";

type Listener = (ev: Event | MessageEvent | CloseEvent) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor() {
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open", new Event("open"));
    });
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    if (type === "open" && this.readyState === MockWebSocket.OPEN) {
      queueMicrotask(() => listener(new Event("open")));
    }
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, ev: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(ev);
    }
  }

  send(data: string): void {
    const envelope = parseHubRpcEnvelope(data) as HubRpcEnvelope;
    if (envelope.kind === "connect") {
      const connected = serializeHubRpcEnvelope({
        kind: "connected",
        payload: {
          protocol: HUB_RPC_VERSION,
          session_id: "sess-1",
          heartbeat_interval_sec: 30,
        },
      });
      this.emit("message", { data: connected } as MessageEvent);
      return;
    }
    if (envelope.kind === "req") {
      const res = serializeHubRpcEnvelope({
        kind: "res",
        id: envelope.id,
        ok: true,
        payload: envelope.method === "notification.list" ? { items: [], total: 0 } : {},
      });
      this.emit("message", { data: res } as MessageEvent);
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", new CloseEvent("close"));
  }
}

describe("runHubRpcTransport", () => {
  it("connects and resolves whenConnected", async () => {
    const handle = runHubRpcTransport({
      hubUrl: "http://127.0.0.1:2658",
      authToken: "test-token",
      reconnect: false,
      createWebSocket: () => new MockWebSocket() as unknown as WebSocket,
      onConnected: async (client) => {
        await client.request("notification.list", { recipient_kind: "user" });
      },
    });

    const client = await handle.whenConnected();
    expect(client).toBeDefined();
    handle.stop();
  });
});
