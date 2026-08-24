import type { FederationHubConfig } from "@freeanima/habitat/core/config/schemas/federation.ts";
import {
  federationHandshakeAckSchema,
  federationPingInputSchema,
  federationPingOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/federation.ts";

import type { FederationIdentityMaterial } from "./handshake.ts";
import {
  createSatelliteHello,
  encodeFederationFrame,
  parseFederationFrame,
  verifyAckSignature,
} from "./handshake.ts";
import { FEDERATION_WS_PATH } from "./config.ts";
import {
  bindSatelliteFederationTransport,
  handleSatelliteRpcResult,
  requestFederationRpc,
} from "./satellite-rpc.ts";

export type SatelliteConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "pending_approval"
  | "reconnecting";

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;

function buildFederationWsUrl(hubOrigin: string): string {
  const base = new URL(hubOrigin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = FEDERATION_WS_PATH;
  base.search = "";
  base.hash = "";
  return base.toString();
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class FederationSatelliteClient {
  private state: SatelliteConnectionState = "disconnected";
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private loopAbort: AbortController | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = 0;
  private hubTrusted = false;
  private onStateChange: ((state: SatelliteConnectionState) => void) | null = null;

  constructor(
    private readonly getIdentity: () => FederationIdentityMaterial | null,
    private readonly getHub: () => FederationHubConfig | null,
    private readonly isEnabled: () => boolean,
  ) {}

  setOnStateChange(handler: ((state: SatelliteConnectionState) => void) | null): void {
    this.onStateChange = handler;
  }

  getState(): SatelliteConnectionState {
    return this.state;
  }

  isHubTrusted(): boolean {
    return this.hubTrusted;
  }

  start(): void {
    this.stop();
    this.loopAbort = new AbortController();
    void this.runLoop(this.loopAbort.signal);
  }

  stop(): void {
    this.loopAbort?.abort();
    this.loopAbort = null;
    this.clearHeartbeat();
    if (this.ws) {
      this.ws.close(1000, "client stop");
      this.ws = null;
    }
    this.setState("disconnected");
    this.reconnectAttempt = 0;
    this.hubTrusted = false;
  }

  private setState(next: SatelliteConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange?.(next);
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      if (!this.isEnabled()) {
        this.setState("disconnected");
        await sleep(2_000, signal).catch(() => undefined);
        continue;
      }
      const identity = this.getIdentity();
      const hub = this.getHub();
      if (!identity || !hub) {
        this.setState("disconnected");
        await sleep(2_000, signal).catch(() => undefined);
        continue;
      }

      try {
        this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
        await this.connectOnce(identity, hub, signal);
        this.reconnectAttempt = 0;
        await this.waitUntilClosed(signal);
      } catch {
        if (signal.aborted) break;
      } finally {
        this.clearHeartbeat();
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      }

      if (signal.aborted) break;
      this.setState("reconnecting");
      const backoff = Math.min(
        MAX_BACKOFF_MS,
        MIN_BACKOFF_MS * 2 ** Math.min(this.reconnectAttempt, 6),
      );
      const jitter = Math.floor(Math.random() * 500);
      this.reconnectAttempt += 1;
      await sleep(backoff + jitter, signal).catch(() => undefined);
    }
    this.setState("disconnected");
  }

  private async connectOnce(
    identity: FederationIdentityMaterial,
    hub: FederationHubConfig,
    signal: AbortSignal,
  ): Promise<void> {
    const url = buildFederationWsUrl(hub.origin);
    const ws = new WebSocket(url);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("websocket error"));
      };
      const onAbort = () => {
        cleanup();
        reject(new Error("aborted"));
      };
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        signal.removeEventListener("abort", onAbort);
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      signal.addEventListener("abort", onAbort, { once: true });
    });

    const hello = createSatelliteHello(identity);
    ws.send(encodeFederationFrame("federation.handshake", hello));

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("handshake timeout"));
      }, 15_000);

      const onMessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        const frame = parseFederationFrame(event.data);
        if (!frame || frame.method !== "federation.handshake.ack") return;
        const ackParsed = federationHandshakeAckSchema.safeParse(frame.payload);
        if (!ackParsed.success) {
          cleanup();
          reject(new Error("invalid ack"));
          return;
        }
        const ack = ackParsed.data;
        if (ack.habitat_instance_id !== hub.habitat_instance_id) {
          cleanup();
          reject(new Error("hub instance mismatch"));
          return;
        }
        if (ack.public_key !== hub.public_key) {
          cleanup();
          reject(new Error("hub public key mismatch"));
          return;
        }
        if (ack.echo_nonce !== hello.nonce) {
          cleanup();
          reject(new Error("echo nonce mismatch"));
          return;
        }
        if (!verifyAckSignature(ack)) {
          cleanup();
          reject(new Error("invalid hub signature"));
          return;
        }
        this.hubTrusted = ack.trust_state === "trusted";
        cleanup();
        resolve();
      };

      const onClose = () => {
        cleanup();
        reject(new Error("closed during handshake"));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        ws.removeEventListener("message", onMessage);
        ws.removeEventListener("close", onClose);
      };

      ws.addEventListener("message", onMessage);
      ws.addEventListener("close", onClose);
    });

    this.lastPongAt = Date.now();
    this.bindLiveTransport(ws);
    this.startHeartbeat(ws, hub);
    this.setState(this.hubTrusted ? "connected" : "pending_approval");
    if (this.hubTrusted) {
      void this.afterConnectedCatchUp();
    }
  }

  private promoteToTrusted(): void {
    if (this.hubTrusted) return;
    this.hubTrusted = true;
    this.setState("connected");
    void this.afterConnectedCatchUp();
  }

  private bindLiveTransport(ws: WebSocket): void {
    bindSatelliteFederationTransport({
      sendRaw: (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      },
      onFrame: () => () => undefined,
    });

    const onMessage = this.handleLiveFederationMessage;
    ws.addEventListener("message", onMessage);
    ws.addEventListener(
      "close",
      () => {
        bindSatelliteFederationTransport(null);
        ws.removeEventListener("message", onMessage);
      },
      { once: true },
    );
  }

  private handleLiveFederationMessage = (event: MessageEvent): void => {
    if (typeof event.data !== "string") return;
    const frame = parseFederationFrame(event.data);
    if (!frame) return;
    if (handleSatelliteRpcResult(frame.method, frame.payload)) return;
    if (frame.method === "federation.ping.result") return;
    if (frame.method === "federation.trust.granted") {
      this.promoteToTrusted();
      return;
    }
    if (!this.hubTrusted) return;
    void import("@freeanima/features/room/domain/room-federation-handlers.ts").then((m) =>
      m.satelliteHandleFederationFrame(frame.method, frame.payload),
    );
  };

  private async afterConnectedCatchUp(): Promise<void> {
    try {
      const { listRooms, getRoomFederationState } =
        await import("@freeanima/habitat/core/db/pg/room");
      const { applyFederatedMessageReplica } =
        await import("@freeanima/features/room/domain/room-federation.ts");
      const { rows } = await listRooms({ limit: 200 });
      for (const row of rows) {
        if (row.federation_mode !== "federated") continue;
        const state = await getRoomFederationState(row.id);
        const result = await requestFederationRpc<{
          room_id: string;
          messages: Array<{
            id: string;
            room_id: string;
            seq: number;
            speaker_public_id: string;
            text: string;
            tool_summary?: string;
            mention_public_ids?: string[];
            created_at: string;
          }>;
        }>("room.federation.catch_up", {
          room_id: row.id,
          from_seq: state?.last_synced_seq ?? 0,
        });
        for (const message of result.messages) {
          await applyFederatedMessageReplica({ message });
        }
      }
    } catch {
      /* catch-up best effort */
    }
  }

  private startHeartbeat(ws: WebSocket, hub: FederationHubConfig): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        ws.close(4000, "heartbeat timeout");
        return;
      }
      const input = federationPingInputSchema.parse({ message: "ping" });
      ws.send(encodeFederationFrame("federation.ping", input));
    }, HEARTBEAT_INTERVAL_MS);

    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const frame = parseFederationFrame(event.data);
      if (!frame || frame.method !== "federation.ping.result") return;
      const parsed = federationPingOutputSchema.safeParse(frame.payload);
      if (!parsed.success) return;
      if (parsed.data.habitat_instance_id !== hub.habitat_instance_id) return;
      this.lastPongAt = Date.now();
    });
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private waitUntilClosed(signal: AbortSignal): Promise<void> {
    const ws = this.ws;
    if (!ws) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        ws.close(1000, "aborted");
        done();
      };
      ws.addEventListener("close", done, { once: true });
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
