import { Elysia } from "elysia";
import {
  broadcastWsReconnect,
  registerTerminalSocket,
  unregisterTerminalSocket,
} from "../shutdown.ts";
import {
  closeTerminalSession,
  createTerminalSession,
  type TerminalEvent,
} from "../terminal-session.ts";

const wsSessions = new Map<string, string>();

function sendEvent(ws: { send: (data: string) => void }, event: TerminalEvent): void {
  ws.send(JSON.stringify(event));
}

export const terminalWsRoutes = new Elysia().ws("/studio/terminal/ws", {
  open(ws) {
    registerTerminalSocket(ws);
    try {
      const { sessionId, pty } = createTerminalSession();
      wsSessions.set(ws.id, sessionId);

      sendEvent(ws, { type: "ready", sessionId });

      pty.onData((data) => {
        sendEvent(ws, { type: "output", data });
      });
      pty.onExit((code) => {
        sendEvent(ws, { type: "exit", code });
        closeTerminalSession(sessionId);
      });
    } catch (e) {
      sendEvent(ws, { type: "error", message: String(e) });
    }
  },
  close(ws) {
    unregisterTerminalSocket(ws);
    const sessionId = wsSessions.get(ws.id);
    if (sessionId) closeTerminalSession(sessionId);
    wsSessions.delete(ws.id);
  },
});

export { broadcastWsReconnect };
