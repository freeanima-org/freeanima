import type { ServerWebSocket } from "bun";
import { parseSapEnvelope, serializeSapEnvelope } from "./protocol.ts";
import { SAP_RELAY_READY_METHOD } from "./relay-client.ts";
import { streamEventMethods } from "./frames/message.ts";
import type { SapClient } from "./router.ts";
import type { SapEnvelope } from "./protocol.ts";
import type { SapMethod, SapRouterInputs } from "./router.ts";

export type RelayWsData = {
  cleanups: Array<() => void>;
};

const FANOUT_EVENT_METHODS = [...streamEventMethods, "conversation.updated"] as const;

export type SapRelayServerState = {
  relaySockets: Set<ServerWebSocket<RelayWsData>>;
  fanoutCleanups: Array<() => void>;
};

export function createSapRelayServerState(): SapRelayServerState {
  return { relaySockets: new Set(), fanoutCleanups: [] };
}

function broadcastRelay(state: SapRelayServerState, envelope: SapEnvelope): void {
  const raw = serializeSapEnvelope(envelope);
  for (const ws of state.relaySockets) {
    try {
      ws.send(raw);
    } catch {
      /* socket may be closing */
    }
  }
}

/** Bind hub stream/session events to relay browsers; call on each transport connect */
export function attachHubEventFanout(state: SapRelayServerState, client: SapClient): void {
  for (const off of state.fanoutCleanups) off();
  state.fanoutCleanups = [];
  for (const method of FANOUT_EVENT_METHODS) {
    const off = client.onEvent(method, (payload) => {
      broadcastRelay(state, { kind: "evt", method, payload });
    });
    state.fanoutCleanups.push(off);
  }
}

export function handleRelayWsOpen(
  state: SapRelayServerState,
  ws: ServerWebSocket<RelayWsData>,
): void {
  ws.data = { cleanups: [] };
  state.relaySockets.add(ws);
  ws.send(
    serializeSapEnvelope({
      kind: "evt",
      method: SAP_RELAY_READY_METHOD,
      payload: { ok: true },
    }),
  );
}

export function handleRelayWsClose(
  state: SapRelayServerState,
  ws: ServerWebSocket<RelayWsData>,
): void {
  state.relaySockets.delete(ws);
  for (const off of ws.data?.cleanups ?? []) off();
}

export async function handleRelayWsMessage(
  ws: ServerWebSocket<RelayWsData>,
  raw: string,
  getClient: () => Promise<SapClient>,
): Promise<void> {
  let envelope: SapEnvelope;
  try {
    envelope = parseSapEnvelope(raw);
  } catch {
    return;
  }
  if (envelope.kind !== "req") return;

  const client = await getClient();
  try {
    const result = await client.request(
      envelope.method as SapMethod,
      envelope.payload as SapRouterInputs[SapMethod],
    );
    ws.send(
      serializeSapEnvelope({
        kind: "res",
        id: envelope.id,
        ok: true,
        payload: result,
      }),
    );
  } catch (e) {
    ws.send(
      serializeSapEnvelope({
        kind: "res",
        id: envelope.id,
        ok: false,
        error: {
          code: "sap_error",
          message: e instanceof Error ? e.message : String(e),
        },
      }),
    );
  }
}
