import { describe, expect, it } from "bun:test";
import { SAP_RELAY_READY_METHOD } from "./relay-client.ts";
import { serializeSapEnvelope } from "./protocol.ts";
import { createSapSidecarClient } from "./sidecar-client.ts";

type Listener = (ev: Event | MessageEvent | CloseEvent) => void;

class MockRelayWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;

  readyState = MockRelayWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(_url: string) {
    queueMicrotask(() => {
      this.readyState = MockRelayWebSocket.OPEN;
      this.emit("open", new Event("open"));
      queueMicrotask(() => {
        const ready = serializeSapEnvelope({
          kind: "evt",
          method: SAP_RELAY_READY_METHOD,
          payload: { ok: true },
        });
        this.emit("message", { data: ready } as MessageEvent);
      });
    });
  }

  addEventListener(type: string, listener: Listener, _opts?: { once?: boolean }): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, ev: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(ev);
    }
  }

  send(_data: string): void {
    /* relay client 仅上行 req，单测不模拟 Hub */
  }

  close(): void {
    this.readyState = MockRelayWebSocket.CLOSED;
    this.emit("close", new CloseEvent("close"));
  }
}

describe("createSapSidecarClient", () => {
  it("连接成功后 whenReady 解析", async () => {
    const client = createSapSidecarClient({
      relayWsUrl: "ws://127.0.0.1/sap/relay/v1",
      reconnect: false,
      createWebSocket: (url) => new MockRelayWebSocket(url) as unknown as WebSocket,
    });

    const relay = await client.whenReady();
    expect(relay).toBeDefined();
    expect(client.getConnectionState()).toBe("connected");
    client.stop();
  });

  it("断线后自动重连", async () => {
    let sockets: MockRelayWebSocket[] = [];
    const states: string[] = [];

    const client = createSapSidecarClient({
      relayWsUrl: "ws://127.0.0.1/sap/relay/v1",
      reconnect: { initialMs: 20, maxMs: 40, factor: 2 },
      onConnectionChange: (state) => states.push(state),
      createWebSocket: (url) => {
        const ws = new MockRelayWebSocket(url);
        sockets.push(ws);
        return ws as unknown as WebSocket;
      },
    });

    await client.whenReady();
    expect(sockets.length).toBe(1);

    sockets[0]!.close();
    await new Promise((r) => {
      setTimeout(r, 80);
    });

    await client.whenReady();
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    expect(states).toContain("disconnected");
    expect(states.at(-1)).toBe("connected");
    client.stop();
  });
});
