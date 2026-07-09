import { describe, expect, it } from "bun:test";
import {
  HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS,
  HUB_RPC_MESSAGE_SEND_TIMEOUT_MS,
} from "@freeanima/shared/hub-rpc";
import { createRpcClient, HubRpcTimeoutError, runHubRpcTransport } from "@freeanima/shared/hub-rpc";
import {
  HUB_RPC_VERSION,
  parseHubRpcEnvelope,
  serializeHubRpcEnvelope,
} from "@freeanima/shared/hub-rpc";
import type { HubRpcEnvelope } from "@freeanima/shared/hub-rpc";

type Listener = (ev: Event | MessageEvent | CloseEvent) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Set<Listener>>();
  closeCalls = 0;
  respondToHeartbeat = true;
  respondToRequests = true;

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
    if (envelope.kind === "evt" && envelope.method === "heartbeat") {
      if (!this.respondToHeartbeat) return;
      this.emit("message", {
        data: serializeHubRpcEnvelope({
          kind: "evt",
          method: "heartbeat",
          payload: { ts: Date.now() },
        }),
      } as MessageEvent);
      return;
    }
    if (envelope.kind === "req") {
      if (!this.respondToRequests) return;
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
    this.closeCalls += 1;
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

  it(
    "无 inbound 超过 liveness 窗口时主动 close",
    async () => {
      const ws = new MockWebSocket();
      ws.respondToHeartbeat = false;

      const handle = runHubRpcTransport({
        hubUrl: "http://127.0.0.1:2658",
        authToken: "test-token",
        reconnect: false,
        livenessSilenceMs: 200,
        livenessCheckIntervalMs: 50,
        createWebSocket: () => ws as unknown as WebSocket,
        onConnected: async () => {},
      });

      await handle.whenConnected();
      expect(handle.getLastInboundAt()).not.toBeNull();

      await Bun.sleep(400);
      expect(ws.closeCalls).toBeGreaterThanOrEqual(1);
      handle.stop();
    },
    { timeout: 5_000 },
  );

  it("断连后 whenConnected 等待新 client 而非返回旧引用", async () => {
    let wsInstance: MockWebSocket | null = null;
    let connectCount = 0;

    const handle = runHubRpcTransport({
      hubUrl: "http://127.0.0.1:2658",
      authToken: "test-token",
      reconnect: { initialMs: 50, maxMs: 50, factor: 1 },
      createWebSocket: () => {
        connectCount += 1;
        const ws = new MockWebSocket();
        wsInstance = ws;
        return ws as unknown as WebSocket;
      },
      onConnected: async () => {},
    });

    const first = await handle.whenConnected();
    expect(first).toBeDefined();
    expect(connectCount).toBe(1);

    wsInstance!.close();
    await Bun.sleep(150);
    const second = await handle.whenConnected();
    expect(second).toBeDefined();
    expect(connectCount).toBeGreaterThanOrEqual(2);
    handle.stop();
  });
});

describe("createRpcClient request timeout", () => {
  it(
    "默认 3s 超时",
    async () => {
      const ws = new MockWebSocket();
      ws.respondToRequests = false;
      const client = createRpcClient({ ws: ws as unknown as WebSocket });
      await client.connect({ auth_token: "t" });

      await expect(
        client.request("notification.list", { recipient_kind: "user" }),
      ).rejects.toBeInstanceOf(HubRpcTimeoutError);
    },
    { timeout: HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS + 2_000 },
  );

  it(
    "message.send 可单独使用 10s 超时",
    async () => {
      const ws = new MockWebSocket();
      ws.respondToRequests = false;
      const client = createRpcClient({ ws: ws as unknown as WebSocket });
      await client.connect({ auth_token: "t" });

      const started = Date.now();
      await expect(
        client.request(
          "message.send",
          { conversation_id: "c1", message: "hi" },
          { timeoutMs: 200 },
        ),
      ).rejects.toBeInstanceOf(HubRpcTimeoutError);
      const elapsed = Date.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(150);
      expect(elapsed).toBeLessThan(HUB_RPC_MESSAGE_SEND_TIMEOUT_MS);
    },
    { timeout: 2_000 },
  );
});
