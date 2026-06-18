import type { ServerWebSocket } from "bun";

export type RuntimeWsClientData = { channel: "runtime" };

export type RuntimeWsBubble = {
  current: { id: string; text: string; createdAt: number } | null;
  pending: number;
  version: number;
};

export type RuntimeWsPlay = {
  id: string;
  slot: string;
  motionId?: string;
};

export type RuntimeWsMessage = {
  type: "runtime";
  bubble: RuntimeWsBubble;
  play: RuntimeWsPlay[];
};

const clients = new Set<ServerWebSocket<RuntimeWsClientData>>();

export function runtimeWsPayload(
  bubble: RuntimeWsBubble,
  play: RuntimeWsPlay[] = [],
): RuntimeWsMessage {
  return { type: "runtime", bubble, play };
}

export function broadcastRuntime(message: RuntimeWsMessage): void {
  const data = JSON.stringify(message);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      clients.delete(ws);
    }
  }
}

export function handleRuntimeWsOpen(ws: ServerWebSocket<RuntimeWsClientData>): void {
  clients.add(ws);
}

export function handleRuntimeWsClose(ws: ServerWebSocket<RuntimeWsClientData>): void {
  clients.delete(ws);
}
