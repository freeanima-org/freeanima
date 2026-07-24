import type { ServerWebSocket } from "bun";
import { closeAllTerminalSessions } from "@freeanima/host/capabilities/outpost/transport/terminal-session";

export type TerminalWsData = {
  conversationId?: string;
};

type TerminalSocket = Pick<ServerWebSocket<TerminalWsData>, "send">;

const terminalSockets = new Set<TerminalSocket>();

export function registerTerminalSocket(ws: TerminalSocket): void {
  terminalSockets.add(ws);
}

export function unregisterTerminalSocket(ws: TerminalSocket): void {
  terminalSockets.delete(ws);
}

export function broadcastWsReconnect(): void {
  const payload = JSON.stringify({ method: "reconnect" });
  for (const ws of terminalSockets) {
    try {
      ws.send(payload);
    } catch {
      /* 连接已断开 */
    }
  }
}

export function shutdownAdmin(): void {
  closeAllTerminalSessions();
}
