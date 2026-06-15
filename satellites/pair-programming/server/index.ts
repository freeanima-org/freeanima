import { join } from "node:path";
import {
  getStudioConfig,
  patchStudioConfig,
  buildFileTree,
  readStudioFile,
  searchStudio,
} from "./studio.ts";
import { connectSap } from "./sap/run.ts";

const PORT = Number(process.env.SATELLITE_PORT ?? 4173);
const APP_DIR = join(import.meta.dir, "..", "app");
const INDEX_FILE = Bun.file(join(APP_DIR, "index.html"));

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(INDEX_FILE);
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true, app: "pair-programming" });
    }
    if (url.pathname === "/api/studio/config" && req.method === "GET") {
      return Response.json(getStudioConfig());
    }
    if (url.pathname === "/api/studio/config" && req.method === "PATCH") {
      return req.json().then((body) => Response.json(patchStudioConfig(body as never)));
    }
    if (url.pathname === "/api/studio/tree") {
      try {
        return Response.json(buildFileTree());
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 400 });
      }
    }
    if (url.pathname === "/api/studio/file") {
      const path = url.searchParams.get("path") ?? "";
      try {
        return Response.json(readStudioFile(path));
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 400 });
      }
    }
    if (url.pathname === "/api/studio/search" && req.method === "POST") {
      return req.json().then((body) => {
        const query = String((body as { query?: string }).query ?? "");
        return Response.json(searchStudio(query));
      });
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`pair-programming satellite server http://127.0.0.1:${server.port}`);

const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
void connectSap(hub).catch((e) => {
  console.warn("SAP connect deferred:", e.message);
});
