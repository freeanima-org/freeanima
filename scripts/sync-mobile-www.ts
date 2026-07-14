/**
 * 将 `src/app/shell/web/dist` 同步进 Capacitor `www/`（路径对齐 `/web/*`）。
 * 用法：仓库根 `bun scripts/sync-mobile-www.ts`（需已有 web dist，或设 SYNC_MOBILE_BUILD_WEB=1）。
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { resolveNativeBuildMeta } from "@freeanima/app/shell/shared/resolve-native-build-meta.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIST = join(ROOT, "src/app/shell/web/dist");
const WWW = join(ROOT, "src/app/shell/mobile/www");
const WWW_WEB = join(WWW, "web");

function ensureWebDist(): void {
  if (existsSync(join(WEB_DIST, "index.html"))) return;
  if (process.env.SYNC_MOBILE_BUILD_WEB === "0") {
    throw new Error(`缺少 ${WEB_DIST}/index.html；请先 bun run build:web`);
  }
  console.log("[sync-mobile-www] web dist 缺失，执行 build:web…");
  const r = spawnSync("bun", ["run", "build:web"], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) throw new Error("build:web 失败");
  if (!existsSync(join(WEB_DIST, "index.html"))) {
    throw new Error("build:web 完成后仍缺少 index.html");
  }
}

function writeRootRedirect(): void {
  writeFileSync(
    join(WWW, "index.html"),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#1d232a" />
    <title>FreeAnima</title>
    <script>
      location.replace("/web/");
    </script>
  </head>
  <body style="margin:0;background:#1d232a"></body>
</html>
`,
    "utf8",
  );
}

function writeNativeBuildMeta(): void {
  const debug = process.env.MOBILE_DEBUG === "1";
  const meta = resolveNativeBuildMeta({
    shell: "mobile",
    channel: debug ? "dev" : "prod",
    repoRoot: ROOT,
  });
  writeFileSync(join(WWW, "native-build-meta.json"), `${JSON.stringify(meta)}\n`, "utf8");
}

ensureWebDist();
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW_WEB, { recursive: true });
cpSync(WEB_DIST, WWW_WEB, { recursive: true });
writeRootRedirect();
writeNativeBuildMeta();
console.log(`[sync-mobile-www] ${WEB_DIST} → ${WWW_WEB}`);
