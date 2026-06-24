import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PKG_DIR = import.meta.dir;
const REPO_ROOT = join(PKG_DIR, "..", "..");
const CHAT_DIR = join(REPO_ROOT, "satellites", "chat");
const WWW_DIR = join(PKG_DIR, "www");
const CHAT_WWW = join(WWW_DIR, "chat");
const SETTINGS_WWW = join(WWW_DIR, "settings");

function runChatBuild(): string {
  const result = Bun.spawnSync(["bun", "build.ts"], {
    cwd: CHAT_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`chat build failed:\n${result.stderr.toString()}`);
  }
  return join(CHAT_DIR, "dist");
}

function rewriteAssetPaths(html: string, prefix: string): string {
  return html
    .replace(/(\s(?:href|src)=["'])\/([^"']+)(["'])/g, `$1${prefix}$2$3`)
    .replace(/(\s(?:href|src)=["'])\.\/([^"']+)(["'])/g, `$1${prefix}$2$3`);
}

function extractChatEntryScript(html: string): string | null {
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

export async function buildAppMobile(): Promise<string> {
  const chatDist = runChatBuild();

  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(CHAT_WWW, { recursive: true });
  mkdirSync(SETTINGS_WWW, { recursive: true });

  cpSync(chatDist, CHAT_WWW, { recursive: true });

  const chatHtmlRaw = readFileSync(join(CHAT_WWW, "index.html"), "utf-8");
  const entryScript = extractChatEntryScript(chatHtmlRaw);
  if (!entryScript) {
    throw new Error("chat dist index.html 缺少入口 script");
  }
  const entryFile = entryScript.replace(/^\//, "");
  const entryPath = `./${entryFile}`;

  await bundleBrowserEntry(join(PKG_DIR, "src", "bridge-init.ts"), CHAT_WWW, "bridge-init.js");
  await bundleBrowserEntry(join(PKG_DIR, "src", "bootstrap.ts"), WWW_DIR, "bootstrap.js");
  await bundleBrowserEntry(
    join(PKG_DIR, "src", "settings", "settings.ts"),
    SETTINGS_WWW,
    "settings.js",
  );

  cpSync(join(PKG_DIR, "src", "settings", "settings.css"), join(SETTINGS_WWW, "settings.css"));
  cpSync(join(PKG_DIR, "src", "settings", "index.html"), join(SETTINGS_WWW, "index.html"));

  const chatHtml = rewriteAssetPaths(chatHtmlRaw, "./")
    .replace(
      /content="width=device-width, initial-scale=1\.0"/,
      'content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
    )
    .replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/, "")
    .replace("</head>", `<script type="module" src="./bridge-init.js"></script></head>`)
    .replace("<html", `<html data-chat-entry="${entryPath}"`);
  writeFileSync(join(CHAT_WWW, "index.html"), chatHtml);

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
