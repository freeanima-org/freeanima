import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PKG_DIR = import.meta.dir;
const REPO_ROOT = join(PKG_DIR, "..", "..");
const CHAT_DIR = join(REPO_ROOT, "satellites", "chat");
const CHAMBER_DIR = join(REPO_ROOT, "frontends", "chamber");
const WWW_DIR = join(PKG_DIR, "www");
const CHAT_WWW = join(WWW_DIR, "chat");
const WEBUI_WWW = join(WWW_DIR, "webui");
const SETTINGS_WWW = join(WWW_DIR, "settings");
const HOME_WWW = join(WWW_DIR, "home");
const CHAMBER_ENTRY_WWW = join(WEBUI_WWW, "chamber", "dashboard");

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

function runChamberBuild(): string {
  runSpawn(CHAMBER_DIR, "build.ts");
  return join(CHAMBER_DIR, "dist");
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

function assertNoDoubleWebuiPrefix(html: string, label: string): void {
  if (html.includes("/webui/webui/")) {
    throw new Error(`${label}: webui 资源路径出现 /webui/webui/ 双前缀`);
  }
}

function injectWebuiBridge(htmlRaw: string, entryPath: string, bridgeFile: string): string {
  // chamber dist 已设 publicPath=/webui/，无需再 rewrite，否则 CSS href 会变成 /webui/webui/…
  return htmlRaw
    .replace(
      /content="width=device-width, initial-scale=1\.0"/,
      'content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
    )
    .replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/, "")
    .replace("</head>", `<script type="module" src="${bridgeFile}"></script></head>`)
    .replace("<html", `<html data-webui-entry="${entryPath}"`);
}

export async function buildAppMobile(): Promise<string> {
  const chatDist = runChatBuild();
  const chamberDist = runChamberBuild();

  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(CHAT_WWW, { recursive: true });
  mkdirSync(WEBUI_WWW, { recursive: true });
  mkdirSync(SETTINGS_WWW, { recursive: true });
  mkdirSync(HOME_WWW, { recursive: true });

  cpSync(chatDist, CHAT_WWW, { recursive: true });
  cpSync(chamberDist, WEBUI_WWW, { recursive: true });

  const chatHtmlRaw = readFileSync(join(CHAT_WWW, "index.html"), "utf-8");
  const chatEntryScript = extractEntryScript(chatHtmlRaw);
  if (!chatEntryScript) {
    throw new Error("chat dist index.html 缺少入口 script");
  }
  const chatEntryPath = `./${chatEntryScript.replace(/^\//, "")}`;

  const webuiHtmlRaw = readFileSync(join(WEBUI_WWW, "index.html"), "utf-8");
  const webuiEntryScript = extractEntryScript(webuiHtmlRaw);
  if (!webuiEntryScript) {
    throw new Error("chamber dist index.html 缺少入口 script");
  }
  const webuiEntryPath = `/webui/${webuiEntryScript.replace(/^\//, "").replace(/^webui\//, "")}`;

  await bundleBrowserEntry(join(PKG_DIR, "src", "bridge-init.ts"), CHAT_WWW, "bridge-init.js");
  await bundleBrowserEntry(
    join(PKG_DIR, "src", "bridge-init-chamber.ts"),
    WEBUI_WWW,
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

  const webuiHtml = injectWebuiBridge(webuiHtmlRaw, webuiEntryPath, "/webui/bridge-init.js");
  assertNoDoubleWebuiPrefix(webuiHtml, "www/webui/index.html");
  writeFileSync(join(WEBUI_WWW, "index.html"), webuiHtml);

  mkdirSync(CHAMBER_ENTRY_WWW, { recursive: true });
  const chamberDashboardHtml = injectWebuiBridge(
    webuiHtmlRaw,
    webuiEntryPath,
    "/webui/bridge-init.js",
  );
  assertNoDoubleWebuiPrefix(chamberDashboardHtml, "www/webui/chamber/dashboard/index.html");
  writeFileSync(join(CHAMBER_ENTRY_WWW, "index.html"), chamberDashboardHtml);

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
