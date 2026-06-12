import type { ServerWebSocket } from "bun";
import { closeAllTerminalSessions } from "./terminal-session.ts";

export type TerminalWsData = {
  sessionId?: string;
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

export function shutdownWebui(): void {
  closeAllTerminalSessions();
}
