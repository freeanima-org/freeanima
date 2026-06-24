#!/usr/bin/env bun
/**
 * 生产模式 Admin SPA 静态资源构建（与 anima service start 生产路径一致）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureAdminProductionCacheDir } from "../platform/admin-frontend/build.ts";

const ADMIN_PUBLIC_PATH = "/admin/";

async function main(): Promise<void> {
  console.log("building admin (production)…");
  const outdir = await ensureAdminProductionCacheDir();
  const htmlPath = join(outdir, "index.html");
  if (!existsSync(htmlPath)) {
    throw new Error(`build-admin: missing ${htmlPath}`);
  }
  const html = readFileSync(htmlPath, "utf-8");
  if (!html.includes(`${ADMIN_PUBLIC_PATH}chunk-`)) {
    throw new Error(`build-admin: ${htmlPath} does not contain ${ADMIN_PUBLIC_PATH}chunk-`);
  }
  console.log(`admin build ready: ${outdir}`);
}

await main();
