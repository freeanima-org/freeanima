#!/usr/bin/env bun
/**
 * 本地开发 Admin SPA：Hub 仅跑 API 时，在另一终端 watch 构建并静态托管 /admin。
 * 用法：anima service start --foreground & bun run dev:admin
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { resolveHubWsUrl } from "../packages/sap-contract/src/urls.ts";
import { buildShellApiFields } from "../packages/satellite-sdk/src/shell-api-fields.ts";
import { buildAdminToDir, resolveAdminAppDir } from "../platform/admin-frontend/build.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const OUTDIR = join(REPO_ROOT, ".anima-dev", "admin");
const PORT = Number(process.env.ADMIN_DEV_PORT ?? 4175);
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const REMOTE_AUTH_TOKEN = process.env.FREEANIMA_REMOTE_AUTH_TOKEN ?? "";

const ADMIN_PREFIX = "/admin";

function resolveAsset(pathname: string): string {
  let rel = pathname.slice(ADMIN_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) return "index.html";
  return rel;
}

function injectHubScript(html: string): string {
  const hubWsUrl = resolveHubWsUrl(HUB_URL);
  const apiFields = buildShellApiFields(HUB_URL, hubWsUrl, REMOTE_AUTH_TOKEN);
  const token = REMOTE_AUTH_TOKEN.trim();
  const hubFetchScript = token
    ? `hubFetch:(function(token,hubOrigin){var hub=hubOrigin.replace(/\\/$/,"");function loopback(h){try{var u=new URL(/^https?:\\/\\//i.test(h)?h:"http://"+h);var host=u.hostname.toLowerCase();return host==="127.0.0.1"||host==="localhost"||host==="::1"}catch(e){return false}}return async function(input,init){var url=typeof input==="string"?input:input instanceof URL?input.href:input.url;if(!token||loopback(hub)||!url.startsWith(hub))return fetch(input,init);var headers=new Headers(init&&init.headers||(input instanceof Request?input.headers:undefined));headers.set("Authorization","Bearer "+token.trim());return fetch(input,Object.assign({},init,{headers:headers}))}})(${JSON.stringify(token)},${JSON.stringify(apiFields.hubUrl)})`
    : "";
  const fields = [
    `hubUrl:${JSON.stringify(apiFields.hubUrl)}`,
    `hubWsUrl:${JSON.stringify(apiFields.hubWsUrl)}`,
    apiFields.remoteAuth ? `remoteAuth:${JSON.stringify(apiFields.remoteAuth)}` : "",
    hubFetchScript,
    "isElectron:false",
    'createFileInstanceStore:function(){throw new Error("dev only")}',
  ]
    .filter(Boolean)
    .join(",");
  const snippet = `<script>window.satelliteShell=window.satelliteShell||{${fields}};</script>`;
  return html.replace("</head>", `${snippet}</head>`);
}

async function buildOnce(watch: boolean): Promise<void> {
  mkdirSync(OUTDIR, { recursive: true });
  await buildAdminToDir(
    resolveAdminAppDir(REPO_ROOT),
    { outdir: OUTDIR, minify: false, watch, sourcemap: true },
    REPO_ROOT,
  );
}

function startServer(): void {
  createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`).pathname;
    if (!pathname.startsWith(ADMIN_PREFIX)) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    const rel = resolveAsset(pathname);
    const filePath = join(OUTDIR, rel);
    try {
      let body = readFileSync(filePath);
      if (rel === "index.html") {
        body = Buffer.from(injectHubScript(body.toString("utf-8")), "utf-8");
      }
      res.setHeader("Content-Type", rel.endsWith(".js") ? "text/javascript" : "text/html");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end("Not Found");
    }
  }).listen(PORT, "127.0.0.1", () => {
    console.log(`[dev:admin] http://127.0.0.1:${PORT}/admin/dashboard?embed=1 (hub ${HUB_URL})`);
  });
}

await buildOnce(true);
startServer();
