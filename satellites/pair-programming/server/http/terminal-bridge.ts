import type { ServerWebSocket } from "bun";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  TerminalSessionError,
} from "../terminal-session.ts";
import { getStudioConfig } from "../studio.ts";

export type TerminalWsData = {
  terminalId: string;
  cleanups: Array<() => void>;
};

function sendJson(ws: ServerWebSocket<TerminalWsData>, event: Record<string, unknown>): void {
  ws.send(JSON.stringify(event));
}

export async function handleTerminalWsOpen(ws: ServerWebSocket<TerminalWsData>): Promise<void> {
  const cleanups: Array<() => void> = [];
  try {
    const cfg = getStudioConfig();
    const { conversationId, pty } = createTerminalSession(cfg.workspace?.trim() || undefined);

    ws.data = { terminalId: conversationId, cleanups, ...(ws.data as object) };

    cleanups.push(
      pty.onData((data) => {
        sendJson(ws, { type: "output", data });
      }),
    );
    cleanups.push(
      pty.onExit((code) => {
        sendJson(ws, { type: "exit", code });
        closeTerminalSession(conversationId);
      }),
    );

    sendJson(ws, { type: "ready", conversationId });
  } catch (e) {
    sendJson(ws, { type: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

export function handleTerminalWsClose(ws: ServerWebSocket<TerminalWsData>): void {
  const data = ws.data;
  for (const off of data?.cleanups ?? []) off();
  const terminalId = data?.terminalId;
  if (terminalId) {
    closeTerminalSession(terminalId);
  }
}

export async function terminalWrite(conversationId: string, data: string): Promise<void> {
  const pty = getTerminalSession(conversationId);
  if (!pty) throw new TerminalSessionError();
  pty.write(data);
}

export async function terminalResize(
  conversationId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const pty = getTerminalSession(conversationId);
  if (!pty) throw new TerminalSessionError();
  pty.resize(cols, rows);
}

export async function terminalClose(conversationId: string): Promise<void> {
  closeTerminalSession(conversationId);
}
