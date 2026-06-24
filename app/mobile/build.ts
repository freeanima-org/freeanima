import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAdminApp } from "@freeanima/admin-frontend/build";

const PKG_DIR = import.meta.dir;
const REPO_ROOT = join(PKG_DIR, "..", "..");
const CHAT_DIR = join(REPO_ROOT, "satellites", "chat");
const WWW_DIR = join(PKG_DIR, "www");
const CHAT_WWW = join(WWW_DIR, "chat");
const ADMIN_WWW = join(WWW_DIR, "admin");
const SETTINGS_WWW = join(WWW_DIR, "settings");
const HOME_WWW = join(WWW_DIR, "home");
const ADMIN_DASHBOARD_WWW = join(ADMIN_WWW, "dashboard");

function runSpawn(cwd: string, script: string): void {
  const result = Bun.spawnSync(["bun", script], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${script} failed in ${cwd}:\n${result.stderr.toString()}`);
  }
}

function runChatBuild(): string {
  runSpawn(CHAT_DIR, "build.ts");
  return join(CHAT_DIR, "dist");
}

async function runAdminBuild(): Promise<string> {
  return buildAdminApp({ minify: true });
}

function rewriteAssetPaths(html: string, prefix: string): string {
  return html
    .replace(/(\s(?:href|src)=["'])\/([^"']+)(["'])/g, `$1${prefix}$2$3`)
    .replace(/(\s(?:href|src)=["'])\.\/([^"']+)(["'])/g, `$1${prefix}$2$3`);
}

function extractEntryScript(html: string): string | null {
  const match = html.match(/<script[^>]+src=["']([^"']+\.js)["']/);
  return match?.[1] ?? null;
}

async function bundleBrowserEntry(entry: string, outdir: string, outfile: string): Promise<void> {
  mkdirSync(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    naming: outfile,
    target: "browser",
    format: "esm",
    minify: true,
    external: [],
  });
  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
}

function assertNoDoubleAdminPrefix(html: string, label: string): void {
  if (html.includes("/admin/admin/")) {
    throw new Error(`${label}: admin 资源路径出现 /admin/admin/ 双前缀`);
  }
}

function injectAdminBridge(htmlRaw: string, entryPath: string, bridgeFile: string): string {
  return htmlRaw
    .replace(
      /content="width=device-width, initial-scale=1\.0"/,
      'content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
    )
    .replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/, "")
    .replace("</head>", `<script type="module" src="${bridgeFile}"></script></head>`)
    .replace("<html", `<html data-admin-entry="${entryPath}"`);
}

export async function buildAppMobile(): Promise<string> {
  const chatDist = runChatBuild();
  const adminDist = await runAdminBuild();

  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(CHAT_WWW, { recursive: true });
  mkdirSync(ADMIN_WWW, { recursive: true });
  mkdirSync(SETTINGS_WWW, { recursive: true });
  mkdirSync(HOME_WWW, { recursive: true });

  cpSync(chatDist, CHAT_WWW, { recursive: true });
  cpSync(adminDist, ADMIN_WWW, { recursive: true });

  const chatHtmlRaw = readFileSync(join(CHAT_WWW, "index.html"), "utf-8");
  const chatEntryScript = extractEntryScript(chatHtmlRaw);
  if (!chatEntryScript) {
    throw new Error("chat dist index.html 缺少入口 script");
  }
  const chatEntryPath = `./${chatEntryScript.replace(/^\//, "")}`;

  const adminHtmlRaw = readFileSync(join(ADMIN_WWW, "index.html"), "utf-8");
  const adminEntryScript = extractEntryScript(adminHtmlRaw);
  if (!adminEntryScript) {
    throw new Error("admin dist index.html 缺少入口 script");
  }
  const adminEntryPath = `/admin/${adminEntryScript.replace(/^\//, "").replace(/^admin\//, "")}`;

  await bundleBrowserEntry(join(PKG_DIR, "src", "bridge-init.ts"), CHAT_WWW, "bridge-init.js");
  await bundleBrowserEntry(
    join(PKG_DIR, "src", "bridge-init-admin.ts"),
    ADMIN_WWW,
    "bridge-init.js",
  );
  await bundleBrowserEntry(join(PKG_DIR, "src", "bootstrap.ts"), WWW_DIR, "bootstrap.js");
  await bundleBrowserEntry(
    join(PKG_DIR, "src", "settings", "settings.ts"),
    SETTINGS_WWW,
    "settings.js",
  );

  cpSync(join(PKG_DIR, "src", "settings", "settings.css"), join(SETTINGS_WWW, "settings.css"));
  cpSync(join(PKG_DIR, "src", "settings", "index.html"), join(SETTINGS_WWW, "index.html"));
  cpSync(join(PKG_DIR, "src", "home", "home.css"), join(HOME_WWW, "home.css"));
  cpSync(join(PKG_DIR, "src", "home", "index.html"), join(HOME_WWW, "index.html"));

  const chatHtml = rewriteAssetPaths(chatHtmlRaw, "./")
    .replace(
      /content="width=device-width, initial-scale=1\.0"/,
      'content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
    )
    .replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/, "")
    .replace("</head>", `<script type="module" src="./bridge-init.js"></script></head>`)
    .replace("<html", `<html data-chat-entry="${chatEntryPath}"`);
  writeFileSync(join(CHAT_WWW, "index.html"), chatHtml);

  const adminHtml = injectAdminBridge(adminHtmlRaw, adminEntryPath, "/admin/bridge-init.js");
  assertNoDoubleAdminPrefix(adminHtml, "www/admin/index.html");
  writeFileSync(join(ADMIN_WWW, "index.html"), adminHtml);

  mkdirSync(ADMIN_DASHBOARD_WWW, { recursive: true });
  const dashboardHtml = injectAdminBridge(adminHtmlRaw, adminEntryPath, "/admin/bridge-init.js");
  assertNoDoubleAdminPrefix(dashboardHtml, "www/admin/dashboard/index.html");
  writeFileSync(join(ADMIN_DASHBOARD_WWW, "index.html"), dashboardHtml);

  const bootstrapHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>FreeAnima</title>
  </head>
  <body>
    <script type="module" src="./bootstrap.js"></script>
  </body>
</html>`;
  writeFileSync(join(WWW_DIR, "index.html"), bootstrapHtml);

  return WWW_DIR;
}

if (import.meta.main) {
  void buildAppMobile().then((dir) => {
    console.log(`built app-mobile www -> ${dir}`);
  });
}
