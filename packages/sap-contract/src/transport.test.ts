import { describe, it, expect } from "bun:test";
import { runSapTransport } from "./transport.ts";
import { SAP_VERSION, parseSapEnvelope, serializeSapEnvelope } from "./protocol.ts";
import type { SapEnvelope } from "./protocol.ts";

type Listener = (ev: Event | MessageEvent | CloseEvent) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;

  readyState = MockWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor() {
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open", new Event("open"));
    });
  }

  addEventListener(type: string, listener: Listener, _opts?: { once?: boolean }): void {
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
    const envelope = parseSapEnvelope(data) as SapEnvelope;
    if (envelope.kind === "connect") {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open", new Event("open"));
      const connected = serializeSapEnvelope({
        kind: "connected",
        payload: {
          protocol: SAP_VERSION,
          instance_id: "abc",
          features_enabled: [],
          heartbeat_interval_sec: 30,
        },
      });
      this.emit("message", { data: connected } as MessageEvent);
      return;
    }
    if (envelope.kind === "req") {
      const method = envelope.method;
      const res = serializeSapEnvelope({
        kind: "res",
        id: envelope.id,
        ok: true,
        payload:
          method === "tool.register"
            ? { registered: 2 }
            : method === "tool.result" || method === "tool.error"
              ? { ok: true }
              : {},
      });
      this.emit("message", { data: res } as MessageEvent);
    }
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", new CloseEvent("close"));
  }
}

describe("runSapTransport", () => {
  it("connects and resolves whenConnected", async () => {
    const handle = runSapTransport({
      hubUrl: "http://127.0.0.1:2658",
      connect: {
        app_id: "test-app",
        instance_id: "inst-1",
        features_requested: [],
      },
      reconnect: false,
      createWebSocket: () => new MockWebSocket() as unknown as WebSocket,
      onConnected: async (client) => {
        await client.request("tool.register", { tools: [], private: true });
      },
    });

    const client = await handle.whenConnected();
    expect(client).toBeDefined();
    expect(handle.getClient()).toBe(client);
    handle.stop();
  });

  it("retries connect without instance_id when hub rejects stale id", async () => {
    let attempt = 0;
    class StaleThenFreshWebSocket {
      static OPEN = 1;
      static CLOSED = 3;
      static CONNECTING = 0;
      readyState = StaleThenFreshWebSocket.CONNECTING;
      private readonly listeners = new Map<string, Set<Listener>>();

      constructor() {
        queueMicrotask(() => {
          this.readyState = StaleThenFreshWebSocket.OPEN;
          this.emit("open", new Event("open"));
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

      send(data: string): void {
        const envelope = parseSapEnvelope(data) as SapEnvelope;
        if (envelope.kind !== "connect") return;
        attempt += 1;
        if (attempt === 1) {
          queueMicrotask(() => {
            this.readyState = StaleThenFreshWebSocket.CLOSED;
            this.emit(
              "close",
              new CloseEvent("close", { code: 1008, reason: "unknown instance_id: abc" }),
            );
          });
          return;
        }
        const connected = serializeSapEnvelope({
          kind: "connected",
          payload: {
            protocol: SAP_VERSION,
            instance_id: "new1",
            features_enabled: [],
            heartbeat_interval_sec: 30,
          },
        });
        this.emit("message", { data: connected } as MessageEvent);
      }

      close(): void {
        this.readyState = StaleThenFreshWebSocket.CLOSED;
        this.emit("close", new CloseEvent("close"));
      }
    }

    const handle = runSapTransport({
      hubUrl: "http://127.0.0.1:2658",
      connect: {
        app_id: "test-app",
        instance_id: "abc",
        features_requested: [],
      },
      reconnect: false,
      createWebSocket: () => new StaleThenFreshWebSocket() as unknown as WebSocket,
      onConnected: async () => {},
    });

    const client = await handle.whenConnected();
    expect(client).toBeDefined();
    expect(attempt).toBe(2);
    handle.stop();
  });

  it("stop rejects whenConnected waiters", async () => {
    class HangingWebSocket {
      static OPEN = 1;
      static CLOSED = 3;
      static CONNECTING = 0;
      readyState = HangingWebSocket.CONNECTING;
      addEventListener(): void {}
      removeEventListener(): void {}
      send(): void {}
      close(): void {}
    }

    const handle = runSapTransport({
      hubUrl: "http://127.0.0.1:2658",
      connect: {
        app_id: "test-app",
        instance_id: "inst-2",
        features_requested: [],
      },
      reconnect: false,
      createWebSocket: () => new HangingWebSocket() as unknown as WebSocket,
      onConnected: async () => {},
    });

    const pending = handle.whenConnected();
    handle.stop();
    await expect(pending).rejects.toThrow(/stopped/);
  });
});
