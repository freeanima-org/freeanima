import { join } from "node:path";
import {
  getStudioConfig,
  patchStudioConfig,
  buildFileTree,
  readStudioFile,
  searchStudio,
} from "./studio.ts";
import { connectSap } from "./sap/run.ts";
import { corsPreflight, jsonResponse, withCors } from "./http/cors.ts";
import { handleHubApi } from "./http/hub-api.ts";

const PORT = Number(process.env.SATELLITE_PORT ?? 4173);
const APP_DIR = join(import.meta.dir, "..", "app");
const INDEX_FILE = Bun.file(join(APP_DIR, "index.html"));

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  const hubApi = await handleHubApi(req, url);
  if (hubApi) return hubApi;

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return withCors(new Response(INDEX_FILE));
  }
  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: "pair-programming" });
  }
  if (url.pathname === "/api/studio/config" && req.method === "GET") {
    return jsonResponse(getStudioConfig());
  }
  if (url.pathname === "/api/studio/config" && req.method === "PATCH") {
    const body = await req.json();
    return jsonResponse(patchStudioConfig(body as never));
  }
  if (url.pathname === "/api/studio/tree") {
    try {
      return jsonResponse(buildFileTree());
    } catch (e) {
      return jsonResponse({ error: String(e) }, 400);
    }
  }
  if (url.pathname === "/api/studio/file") {
    const path = url.searchParams.get("path") ?? "";
    try {
      return jsonResponse(readStudioFile(path));
    } catch (e) {
      return jsonResponse({ error: String(e) }, 400);
    }
  }
  if (url.pathname === "/api/studio/search" && req.method === "POST") {
    const body = await req.json();
    const query = String((body as { query?: string }).query ?? "");
    return jsonResponse(searchStudio(query));
  }

  return jsonResponse({ error: "Not Found" }, 404);
}

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    return route(req);
  },
});

console.log(`pair-programming satellite server http://127.0.0.1:${server.port}`);

const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
void connectSap(hub).catch((e) => {
  console.warn("SAP connect deferred:", e.message);
});
