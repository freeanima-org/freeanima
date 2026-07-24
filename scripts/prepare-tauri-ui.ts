#!/usr/bin/env bun
/**
 * 打包前：按 target 构建 web → `src/app/shell/tauri/src-tauri/ui/web`。
 *
 * FREEANIMA_TAURI_TARGET=desktop|mobile（默认 desktop）
 * - desktop：dist-desktop + ui/companion（frontendDist，非 file:// resources）+ 启动 splash
 * - mobile：dist-mobile，无 companion
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseShellBuildTarget,
  shellWebDistDirName,
  type ShellBuildTarget,
} from "@freeanima/client/portal-sdk/shell-build-target.ts";
import { resolveBuildChannelFromEnv } from "@freeanima/host/core/config/build-meta.ts";
import { resolveNativeBuildMeta } from "@freeanima/app/shell/shared/resolve-native-build-meta.ts";
import { buildCompanionApp } from "@freeanima/features/companion/lib/exports/build.ts";
import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target: ShellBuildTarget =
  process.env.FREEANIMA_TAURI_TARGET === "mobile"
    ? "mobile"
    : parseShellBuildTarget(process.env.FREEANIMA_SHELL_TARGET ?? "desktop");
const srcTauri = join(root, "src/app/shell/tauri/src-tauri");
const webDist = join(root, "src/app/shell/web", shellWebDistDirName(target));
const uiRoot = join(srcTauri, "ui");
const uiWeb = join(uiRoot, "web");
const companionUi = join(uiRoot, "companion");
const tauriConfPath = join(srcTauri, "tauri.conf.json");
const cargoTargetDir = join(srcTauri, "target");
/** 历史 resources 占位；desktop 已迁入 frontendDist，清理以免误用 file:// */
const legacyCompanionResource = join(srcTauri, "companion-dist");

/** 目录迁移后 Cargo/Tauri 缓存仍可能引用已删的 desktop/tauri 路径，导致 plugin permissions 读失败。 */
function purgeStaleCargoTargetIfNeeded(): void {
  if (!existsSync(cargoTargetDir)) return;
  let hit = false;
  try {
    const probe = Bun.spawnSync(
      [
        "rg",
        "-l",
        "shell/desktop/(electron|tauri)|shell/mobile/(android|tauri|capacitor)",
        cargoTargetDir,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    hit = probe.exitCode === 0;
  } catch {
    // CI / 精简环境可能无 rg；跳过陈旧 target 探测
    return;
  }
  if (!hit) return;
  console.warn("[prepare-tauri] 检测到陈旧 Cargo target（含旧 shell 路径），清理后重编…");
  rmSync(cargoTargetDir, { recursive: true, force: true });
}

purgeStaleCargoTargetIfNeeded();

const BOOT_HEAD = `<style id="fa-boot-style">html,body{margin:0;height:100%;background:#0a0a0b;color:#c8c8cc;font-family:system-ui,sans-serif}#fa-boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;letter-spacing:.04em;user-select:none;pointer-events:none;z-index:2147483646}#fa-boot strong{font-size:1.25rem;font-weight:600;color:#eee}#fa-boot span{font-size:.8rem;opacity:.55}#root{position:relative;z-index:1;min-height:100%}</style>`;

/** 仅 markup；隐藏脚本必须在 #root 之后执行（见 injectBootSplash）。 */
const BOOT_MARKUP = `<div id="fa-boot"><strong>FreeAnima</strong><span>正在启动…</span></div>`;

/**
 * 启动画面隐藏逻辑。
 * 注意：不可放在 #root 之前的同步 script——解析到那时 #root 尚不存在，会直接 return 且永不隐藏。
 */
const BOOT_HIDE_SCRIPT = `<script>
(function(){
  function setup(){
    var boot=document.getElementById("fa-boot");
    var root=document.getElementById("root");
    if(!boot||!root)return;
    var done=false;
    function hide(){
      if(done)return; done=true;
      boot.remove();
      var s=document.getElementById("fa-boot-style"); if(s)s.remove();
    }
    if(root.childNodes.length){ hide(); return; }
    new MutationObserver(function(){ if(root.childNodes.length) hide(); })
      .observe(root,{childList:true});
    setTimeout(hide, 12000);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
</script>`;

function injectBootSplash(indexPath: string): void {
  let html = readFileSync(indexPath, "utf-8");
  if (html.includes('id="fa-boot"')) return;

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${BOOT_HEAD}</head>`);
  }

  // markup 放 body 开头（尽早显示）；hide 脚本放在 #root 之后，避免同步脚本拿不到 root。
  if (html.includes("<body>")) {
    html = html.replace("<body>", `<body>${BOOT_MARKUP}`);
  } else if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', `${BOOT_MARKUP}<div id="root"></div>`);
  } else {
    console.warn("[prepare-tauri] skip splash: body/#root not found");
    return;
  }

  if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', `<div id="root"></div>${BOOT_HIDE_SCRIPT}`);
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", `${BOOT_HIDE_SCRIPT}</body>`);
  } else {
    html = `${html}\n${BOOT_HIDE_SCRIPT}`;
  }

  writeFileSync(indexPath, html, "utf-8");
}

function readTauriProductVersion(): string | undefined {
  try {
    const conf = JSON.parse(readFileSync(tauriConfPath, "utf-8")) as { version?: string };
    const v = conf.version?.trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

function writeNativeBuildMeta(destDir: string): void {
  const channel = resolveBuildChannelFromEnv("dev");
  const version =
    process.env.FREEANIMA_BUILD_VERSION?.trim() ||
    process.env.DESKTOP_SHELL_VERSION?.trim() ||
    readTauriProductVersion();
  const meta = resolveNativeBuildMeta({
    shell: target === "mobile" ? "mobile" : "desktop",
    channel,
    repoRoot: root,
    ...(version ? { version } : {}),
  });
  const path = join(destDir, "native-build-meta.json");
  writeFileSync(path, `${JSON.stringify(meta, null, 2)}\n`, "utf-8");

  const indexPath = join(destDir, "index.html");
  if (existsSync(indexPath)) {
    let html = readFileSync(indexPath, "utf-8");
    const script = `<script>window.__FREEANIMA_NATIVE_BUILD_META__=${JSON.stringify(meta)};</script>`;
    if (html.includes("__FREEANIMA_NATIVE_BUILD_META__")) {
      html = html.replace(
        /<script>window\.__FREEANIMA_NATIVE_BUILD_META__=[\s\S]*?<\/script>/,
        script,
      );
    } else if (html.includes("</head>")) {
      html = html.replace("</head>", `${script}</head>`);
    } else {
      html = `${script}\n${html}`;
    }
    writeFileSync(indexPath, html, "utf-8");
  }

  console.log(`[prepare-tauri] native-build-meta → ${path} (${meta.version} / ${meta.channel})`);
}

process.env.FREEANIMA_SHELL_TARGET = target;
console.log(`[prepare-tauri] target=${target} build-web…`);
const web = Bun.spawnSync(["bun", "scripts/build-web.ts"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
});
if (web.exitCode !== 0) process.exit(web.exitCode ?? 1);

if (!existsSync(join(webDist, "index.html"))) {
  console.error(`[prepare-tauri] missing ${webDist}/index.html`);
  process.exit(1);
}

if (existsSync(uiRoot)) rmSync(uiRoot, { recursive: true });
mkdirSync(uiWeb, { recursive: true });
cpSync(webDist, uiWeb, { recursive: true });
if (target === "desktop") {
  injectBootSplash(join(uiWeb, "index.html"));
}
writeNativeBuildMeta(uiWeb);
writeFileSync(
  join(uiRoot, "index.html"),
  `<!doctype html><meta http-equiv="refresh" content="0;url=web/index.html" /><script>location.replace("web/index.html"+location.hash)</script>\n`,
  "utf-8",
);
console.log(`[prepare-tauri] app-ui → ${uiWeb} (${target})`);

if (target === "desktop") {
  console.log("[prepare-tauri] build companion…");
  process.env.FREEANIMA_SHELL_TARGET = "desktop";
  const companionDist = await buildCompanionApp({ minify: true });
  if (existsSync(companionUi)) rmSync(companionUi, { recursive: true });
  mkdirSync(dirname(companionUi), { recursive: true });
  cpSync(companionDist, companionUi, { recursive: true });
  if (!existsSync(join(companionUi, "index.html"))) {
    console.error(`[prepare-tauri] missing ${companionUi}/index.html`);
    process.exit(1);
  }
  // 清理历史 resources/companion-dist，避免打包再嵌入空/旧资源
  if (existsSync(legacyCompanionResource)) {
    rmSync(legacyCompanionResource, { recursive: true });
    mkdirSync(legacyCompanionResource, { recursive: true });
    writeFileSync(join(legacyCompanionResource, ".gitkeep"), "");
  }
  console.log(`[prepare-tauri] companion → ${companionUi} (frontendDist)`);
} else {
  // mobile 无伴侣窗；若仍残留 companion-dist，保持空占位以免旧配置踩坑
  if (existsSync(companionUi)) rmSync(companionUi, { recursive: true });
  if (existsSync(legacyCompanionResource)) {
    rmSync(legacyCompanionResource, { recursive: true });
    mkdirSync(legacyCompanionResource, { recursive: true });
    writeFileSync(join(legacyCompanionResource, ".gitkeep"), "");
  }
  console.log("[prepare-tauri] skip companion (mobile)");
}

applyTauriShellIdentity({
  target: target === "mobile" ? "mobile" : "desktop",
  srcTauri,
});
