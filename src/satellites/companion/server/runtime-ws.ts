import type { WebSocket } from "ws";

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

const clients = new Set<WebSocket>();

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
      if (ws.readyState === 1) {
        ws.send(data);
      }
    } catch {
      clients.delete(ws);
    }
  }
}

export function handleRuntimeWsOpen(ws: WebSocket): void {
  clients.add(ws);
}

export function handleRuntimeWsClose(ws: WebSocket): void {
  clients.delete(ws);
}
