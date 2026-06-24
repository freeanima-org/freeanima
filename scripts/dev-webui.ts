#!/usr/bin/env bun
/**
 * 本地开发 WebUI：Hub 仅跑 API 时，在另一终端 watch 构建并静态托管 /webui。
 * 用法：anima service start --foreground & bun run dev:webui
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { buildWebuiToDir, resolveWebuiAppDir } from "../platform/connectors/webui/webui-bundle.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const OUTDIR = join(REPO_ROOT, ".anima-dev", "webui");
const PORT = Number(process.env.WEBUI_DEV_PORT ?? 4175);
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");

const WEBUI_PREFIX = "/webui";

function resolveAsset(pathname: string): string {
  let rel = pathname.slice(WEBUI_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) return "index.html";
  return rel;
}

function injectHubScript(html: string): string {
  const snippet = `<script>window.satelliteShell=window.satelliteShell||{hubUrl:${JSON.stringify(HUB_URL)},hubWsUrl:${JSON.stringify(HUB_URL.replace(/^http/, "ws") + "/sap/v1")},isElectron:false,createFileInstanceStore:function(){throw new Error("dev only")}};</script>`;
  return html.replace("</head>", `${snippet}</head>`);
}

async function buildOnce(watch: boolean): Promise<void> {
  mkdirSync(OUTDIR, { recursive: true });
  await buildWebuiToDir(
    resolveWebuiAppDir(REPO_ROOT),
    { outdir: OUTDIR, minify: false, watch, sourcemap: true },
    REPO_ROOT,
  );
}

function startServer(): void {
  createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`).pathname;
    if (!pathname.startsWith(WEBUI_PREFIX)) {
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
    console.log(
      `[dev:webui] http://127.0.0.1:${PORT}/webui/chamber/dashboard?embed=1 (hub ${HUB_URL})`,
    );
  });
}

await buildOnce(true);
startServer();
