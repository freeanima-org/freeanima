import type { ServerWebSocket } from "bun";
import { getSapClient } from "../sap/hub.ts";
import { getStudioConfig } from "../studio.ts";

type TerminalWsData = {
  terminalId: string;
  cleanups: Array<() => void>;
};

function hubUrl(): string {
  return (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
}

function sendJson(ws: ServerWebSocket<TerminalWsData>, event: Record<string, unknown>): void {
  ws.send(JSON.stringify(event));
}

export async function handleTerminalWsOpen(ws: ServerWebSocket<TerminalWsData>): Promise<void> {
  const cleanups: Array<() => void> = [];
  try {
    const client = await getSapClient(hubUrl());
    const cfg = getStudioConfig();
    const { terminal_id: terminalId } = await client.request("terminal.attach", {
      cwd: cfg.workspace?.trim() || undefined,
    });

    ws.data = { terminalId, cleanups };

    cleanups.push(
      client.onEvent("terminal.output", (payload) => {
        const p = payload as { terminal_id?: string; data?: string };
        if (p.terminal_id !== terminalId || p.data === undefined) return;
        sendJson(ws, { type: "output", data: p.data });
      }),
    );
    cleanups.push(
      client.onEvent("terminal.exit", (payload) => {
        const p = payload as { terminal_id?: string; code?: number };
        if (p.terminal_id !== terminalId) return;
        sendJson(ws, { type: "exit", code: p.code ?? 0 });
      }),
    );
    cleanups.push(
      client.onEvent("terminal.error", (payload) => {
        const p = payload as { terminal_id?: string; message?: string };
        if (p.terminal_id !== terminalId) return;
        sendJson(ws, { type: "error", message: p.message ?? "terminal error" });
      }),
    );

    sendJson(ws, { type: "ready", sessionId: terminalId });
  } catch (e) {
    sendJson(ws, { type: "error", message: e instanceof Error ? e.message : String(e) });
  }
}

export function handleTerminalWsClose(ws: ServerWebSocket<TerminalWsData>): void {
  const data = ws.data;
  for (const off of data?.cleanups ?? []) off();
  const terminalId = data?.terminalId;
  if (terminalId) {
    void getSapClient(hubUrl())
      .then((client) => client.request("terminal.close", { terminal_id: terminalId }))
      .catch(() => {});
  }
}

export async function terminalWrite(sessionId: string, data: string): Promise<void> {
  const client = await getSapClient(hubUrl());
  await client.request("terminal.write", { terminal_id: sessionId, data });
}

export async function terminalResize(sessionId: string, cols: number, rows: number): Promise<void> {
  const client = await getSapClient(hubUrl());
  await client.request("terminal.resize", { terminal_id: sessionId, cols, rows });
}

export async function terminalClose(sessionId: string): Promise<void> {
  const client = await getSapClient(hubUrl());
  await client.request("terminal.close", { terminal_id: sessionId });
}

export type { TerminalWsData };
