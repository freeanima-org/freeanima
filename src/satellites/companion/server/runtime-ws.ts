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

type RuntimeExternalListener = (message: RuntimeWsMessage) => void;
const externalListeners = new Set<RuntimeExternalListener>();

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
  for (const listener of externalListeners) {
    try {
      listener(message);
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Electron main 等注册：旁路 localhost WS，向 overlay 推送 runtime */
export function addRuntimeExternalListener(listener: RuntimeExternalListener): () => void {
  externalListeners.add(listener);
  return () => {
    externalListeners.delete(listener);
  };
}

export function handleRuntimeWsOpen(ws: WebSocket): void {
  clients.add(ws);
}

export function handleRuntimeWsClose(ws: WebSocket): void {
  clients.delete(ws);
}
