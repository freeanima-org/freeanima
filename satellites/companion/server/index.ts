import type { ServerWebSocket } from "bun";
import { connectSap } from "./sap/run.ts";
import { getSapClient, getSapInstanceId } from "./sap/hub.ts";
import { corsPreflight, jsonResponse } from "./http/cors.ts";
import {
  handleRelayWsClose,
  handleRelayWsMessage,
  handleRelayWsOpen,
  type RelayWsData,
} from "./sap/relay.ts";
import { handlePetWsClose, handlePetWsOpen, type PetWsData } from "./pet-state.ts";
import { loadConfig, saveConfig, hubUrlFromConfig, type CompanionConfig } from "./config.ts";
import { ensureCompanionDataDir } from "./paths.ts";
import { handleModelUpload } from "./models.ts";
import { serveStatic } from "./static.ts";

const PORT = Number(process.env.SATELLITE_PORT ?? 4176);
const HTTP_URL = `http://127.0.0.1:${PORT}`;

type ServerWsData = ({ channel: "relay" } & RelayWsData) | ({ channel: "pet" } & PetWsData);

ensureCompanionDataDir();

export async function route(req: Request, server: Bun.Server<ServerWsData>): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if (url.pathname === "/sap/relay/v1") {
    if (server.upgrade(req, { data: { channel: "relay", cleanups: [] } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/api/pet/ws") {
    if (server.upgrade(req, { data: { channel: "pet", cleanups: [] } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/config.json" && req.method === "GET") {
    const cfg = loadConfig();
    return jsonResponse({
      app_id: "companion",
      instance_id: getSapInstanceId(),
      relay_ws_url: `${HTTP_URL.replace(/^http/, "ws")}/sap/relay/v1`,
      hub_url: cfg.hub_url,
      model_path: cfg.model_path,
    });
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    return jsonResponse(loadConfig());
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const body = (await req.json()) as Partial<CompanionConfig>;
    const next = saveConfig(body);
    return jsonResponse(next);
  }

  if (url.pathname === "/api/models/upload") {
    return handleModelUpload(req);
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: "companion" });
  }

  return serveStatic(url.pathname);
}

const server = Bun.serve<ServerWsData>({
  port: PORT,
  fetch(req, srv) {
    return route(req, srv);
  },
  websocket: {
    open(ws) {
      if (ws.data.channel === "pet") {
        handlePetWsOpen(ws as ServerWebSocket<PetWsData & { channel: "pet" }>);
        return;
      }
      handleRelayWsOpen(ws as ServerWebSocket<RelayWsData & { channel: "relay" }>);
    },
    message(ws, message) {
      if (ws.data.channel !== "relay") return;
      void handleRelayWsMessage(
        ws as ServerWebSocket<RelayWsData & { channel: "relay" }>,
        String(message),
        () => getSapClient(hubUrlFromConfig(), HTTP_URL),
      );
    },
    close(ws) {
      if (ws.data.channel === "pet") {
        handlePetWsClose(ws as ServerWebSocket<PetWsData & { channel: "pet" }>);
        return;
      }
      handleRelayWsClose(ws as ServerWebSocket<RelayWsData & { channel: "relay" }>);
    },
  },
});

console.log(`companion satellite ${HTTP_URL}`);

void connectSap(hubUrlFromConfig(), HTTP_URL);

export { server, HTTP_URL, serveStatic };
