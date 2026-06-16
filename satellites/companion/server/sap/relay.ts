import type { ServerWebSocket } from "bun";
import {
  parseSapEnvelope,
  SAP_RELAY_READY_METHOD,
  serializeSapEnvelope,
  streamEventMethods,
  type SapClient,
  type SapEnvelope,
  type SapMethod,
  type SapRouterInputs,
} from "@freeanima/sap-contract";

export type RelayWsData = {
  cleanups: Array<() => void>;
};

const relaySockets = new Set<ServerWebSocket<RelayWsData>>();
let fanoutAttached = false;

const FANOUT_EVENT_METHODS = [...streamEventMethods, "session.updated"] as const;

function broadcastRelay(envelope: SapEnvelope): void {
  const raw = serializeSapEnvelope(envelope);
  for (const ws of relaySockets) {
    try {
      ws.send(raw);
    } catch {
      /* socket may be closing */
    }
  }
}

export function attachHubEventFanout(client: SapClient): void {
  if (fanoutAttached) return;
  fanoutAttached = true;
  for (const method of FANOUT_EVENT_METHODS) {
    client.onEvent(method, (payload) => {
      broadcastRelay({ kind: "evt", method, payload });
    });
  }
}

export function handleRelayWsOpen(ws: ServerWebSocket<RelayWsData>): void {
  ws.data = { cleanups: [] };
  relaySockets.add(ws);
  ws.send(
    serializeSapEnvelope({
      kind: "evt",
      method: SAP_RELAY_READY_METHOD,
      payload: { ok: true },
    }),
  );
}

export function handleRelayWsClose(ws: ServerWebSocket<RelayWsData>): void {
  relaySockets.delete(ws);
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
