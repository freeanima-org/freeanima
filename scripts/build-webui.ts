#!/usr/bin/env bun
/**
 * 生产模式 WebUI 静态资源构建（与 anima service start 生产路径一致）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureWebuiProductionCacheDir } from "../platform/connectors/webui/webui-bundle.ts";

const WEBUI_PUBLIC_PATH = "/webui/";

async function main(): Promise<void> {
  console.log("building webui (production)…");
  const outdir = await ensureWebuiProductionCacheDir();
  const htmlPath = join(outdir, "index.html");
  if (!existsSync(htmlPath)) {
    throw new Error(`build-webui: missing ${htmlPath}`);
  }
  const html = readFileSync(htmlPath, "utf-8");
  if (!html.includes(`${WEBUI_PUBLIC_PATH}chunk-`)) {
    throw new Error(`build-webui: ${htmlPath} does not contain ${WEBUI_PUBLIC_PATH}chunk-`);
  }
  console.log(`webui build ready: ${outdir}`);
}

await main();
