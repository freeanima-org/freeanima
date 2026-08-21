#!/usr/bin/env bun
/**
 * 打包前：按 target 构建 web → `packages/frontend/portal/app/tauri/src-tauri/ui/web`。
 *
 * FREEANIMA_TAURI_TARGET=desktop|mobile（默认 desktop）
 * - desktop：dist-desktop + ui/companion + ui/coding + ui/pomodoro-float（frontendDist，非 file:// resources）+ 启动 splash
 * - mobile：dist-mobile，无 companion / coding / pomodoro-float
 *
 * 加速：
 * - 默认并行构建 web +（desktop 时）companion/coding/pomodoro-float
 * - FREEANIMA_SKIP_UI=1：若 ui 产物齐全则跳过全部前端构建
 * - FREEANIMA_UI_INCREMENTAL=1（local channel 默认开启；=0 强制关闭）：输入指纹未变则跳过
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseShellBuildTarget,
  shellWebDistDirName,
  type ShellBuildTarget,
} from "@freeanima/client/portal-sdk/shell-build-target.ts";
import { resolveBuildChannelFromEnv } from "@freeanima/habitat/core/config/build-meta.ts";
import { resolveBuildVersionFromEnv } from "@freeanima/habitat/core/config/resolve-build-version.ts";
import {
  resolveDesktopShellIdentity,
  resolveMobileShellIdentity,
} from "@freeanima/habitat/core/config/shell-identity.ts";
import { resolveNativeBuildMeta } from "@freeanima/portal/app/shared/resolve-native-build-meta.ts";
import { buildCompanionApp } from "@freeanima/features/companion/lib/exports/build.ts";
import { buildCodingApp } from "@freeanima/features/coding/lib/exports/build.ts";
import { buildPomodoroFloatApp } from "@freeanima/features/pomodoro/build-float.ts";
import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";
import { isRecord } from "@freeanima/shared/util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target: ShellBuildTarget =
  process.env.FREEANIMA_TAURI_TARGET === "mobile"
    ? "mobile"
    : parseShellBuildTarget(process.env.FREEANIMA_SHELL_TARGET ?? "desktop");
const srcTauri = join(root, "packages/frontend/portal/app/tauri/src-tauri");
const webDist = join(root, "packages/frontend/portal/app/web", shellWebDistDirName(target));
const uiRoot = join(srcTauri, "ui");
const uiWeb = join(uiRoot, "web");
const companionUi = join(uiRoot, "companion");
const codingUi = join(uiRoot, "coding");
const pomodoroFloatUi = join(uiRoot, "pomodoro-float");
const cargoTargetDir = join(srcTauri, "target");
const stampPath = join(uiRoot, ".prepare-stamp.json");
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

const buildChannel = resolveBuildChannelFromEnv("local");
const splashProductName =
  target === "mobile"
    ? resolveMobileShellIdentity(buildChannel).appName
    : resolveDesktopShellIdentity(buildChannel).productName;

const skipUiForced = process.env.FREEANIMA_SKIP_UI === "1";
const incrementalEnv = process.env.FREEANIMA_UI_INCREMENTAL?.trim();
const incrementalEnabled =
  incrementalEnv === "1" || (incrementalEnv !== "0" && buildChannel === "local" && !skipUiForced);

type PrepareStamp = {
  target: string;
  channel: string;
  fingerprint: string;
};

function accumulatePath(hash: ReturnType<typeof createHash>, absPath: string): void {
  if (!existsSync(absPath)) return;
  const st = statSync(absPath);
  if (st.isFile()) {
    hash.update(`${relative(root, absPath)}\0${st.size}\0${Math.trunc(st.mtimeMs)}\n`);
    return;
  }
  if (!st.isDirectory()) return;
  const stack = [absPath];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) break;
    let names: string[];
    try {
      names = readdirSync(cur);
    } catch {
      continue;
    }
    for (const name of names) {
      if (
        name === "node_modules" ||
        name === "dist" ||
        name === "dist-float" ||
        name === "dist-desktop" ||
        name === "dist-mobile" ||
        name.startsWith(".")
      ) {
        continue;
      }
      const p = join(cur, name);
      let child: ReturnType<typeof statSync>;
      try {
        child = statSync(p);
      } catch {
        continue;
      }
      if (child.isDirectory()) {
        stack.push(p);
      } else if (child.isFile()) {
        hash.update(`${relative(root, p)}\0${child.size}\0${Math.trunc(child.mtimeMs)}\n`);
      }
    }
  }
}

function computeUiFingerprint(): string {
  const hash = createHash("sha256");
  hash.update(`target=${target}\nchannel=${buildChannel}\n`);
  accumulatePath(hash, join(root, "scripts/build-web.ts"));
  accumulatePath(hash, join(root, "scripts/prepare-tauri-ui.ts"));
  accumulatePath(hash, join(root, "packages/frontend/client"));
  accumulatePath(hash, join(root, "packages/frontend/ui-kit"));
  accumulatePath(hash, join(root, "packages/frontend/portal/app/web"));
  accumulatePath(hash, join(root, "packages/frontend/features/companion"));
  accumulatePath(hash, join(root, "packages/frontend/features/coding"));
  accumulatePath(hash, join(root, "packages/frontend/features/pomodoro"));
  accumulatePath(hash, join(root, "packages/frontend/features/chat"));
  accumulatePath(hash, join(root, "packages/frontend/features/task"));
  return hash.digest("hex");
}

function uiOutputsReady(): boolean {
  if (!existsSync(join(uiWeb, "index.html"))) return false;
  if (target !== "desktop") return true;
  return (
    existsSync(join(companionUi, "index.html")) &&
    existsSync(join(codingUi, "index.html")) &&
    existsSync(join(pomodoroFloatUi, "index.html"))
  );
}

function readStamp(): PrepareStamp | null {
  if (!existsSync(stampPath)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(stampPath, "utf-8"));
    if (!isRecord(raw)) return null;
    const targetV = raw["target"];
    const channelV = raw["channel"];
    const fingerprintV = raw["fingerprint"];
    if (
      typeof targetV !== "string" ||
      typeof channelV !== "string" ||
      typeof fingerprintV !== "string"
    ) {
      return null;
    }
    return {
      target: targetV,
      channel: channelV,
      fingerprint: fingerprintV,
    };
  } catch {
    return null;
  }
}

function writeStamp(fp: string): void {
  mkdirSync(uiRoot, { recursive: true });
  const body: PrepareStamp = { target, channel: buildChannel, fingerprint: fp };
  writeFileSync(stampPath, `${JSON.stringify(body, null, 2)}\n`, "utf-8");
}

function finishWithIdentity(): void {
  applyTauriShellIdentity({
    target: target === "mobile" ? "mobile" : "desktop",
    srcTauri,
  });
}

const fingerprint = computeUiFingerprint();
const stamp = readStamp();
const stampFresh =
  stamp != null &&
  stamp.target === target &&
  stamp.channel === buildChannel &&
  stamp.fingerprint === fingerprint;

if ((skipUiForced || (incrementalEnabled && stampFresh)) && uiOutputsReady()) {
  console.log(
    `[prepare-tauri] skip UI rebuild (${skipUiForced ? "FREEANIMA_SKIP_UI=1" : "incremental"}) fingerprint=${fingerprint.slice(0, 12)}…`,
  );
  finishWithIdentity();
  process.exit(0);
}

const BOOT_HEAD = `<style id="fa-boot-style">html,body{margin:0;height:100%;background:#0a0a0b;color:#c8c8cc;font-family:system-ui,sans-serif}#fa-boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;letter-spacing:.04em;user-select:none;pointer-events:none;z-index:2147483646}#fa-boot strong{font-size:1.25rem;font-weight:600;color:#eee}#fa-boot span{font-size:.8rem;opacity:.55}#root{position:relative;z-index:1;min-height:100%}</style>`;

/** 仅 markup；隐藏脚本必须在 #root 之后执行（见 injectBootSplash）。 */
function bootMarkup(productName: string): string {
  const safe = productName
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return `<div id="fa-boot"><strong>${safe}</strong><span>正在启动…</span></div>`;
}

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

function injectBootSplash(indexPath: string, productName: string): void {
  let html = readFileSync(indexPath, "utf-8");
  if (html.includes('id="fa-boot"')) return;

  const markup = bootMarkup(productName);

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${BOOT_HEAD}</head>`);
  }

  // markup 放 body 开头（尽早显示）；hide 脚本放在 #root 之后，避免同步脚本拿不到 root。
  if (html.includes("<body>")) {
    html = html.replace("<body>", `<body>${markup}`);
  } else if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', `${markup}<div id="root"></div>`);
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

function writeNativeBuildMeta(destDir: string): void {
  const channel = buildChannel;
  // 与 apply-tauri-shell-identity / pack 产物名同源，避免 canary 回落成 tauri.conf 的 release 号
  const version = resolveBuildVersionFromEnv(root, process.env, { channel });
  const meta = resolveNativeBuildMeta({
    shell: target === "mobile" ? "mobile" : "desktop",
    channel,
    repoRoot: root,
    version,
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

async function buildWebDist(): Promise<void> {
  process.env.FREEANIMA_SHELL_TARGET = target;
  console.log(`[prepare-tauri] build-web (${target})…`);
  const proc = Bun.spawn(["bun", "scripts/build-web.ts"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`build-web failed (exit ${code})`);
  }
  if (!existsSync(join(webDist, "index.html"))) {
    throw new Error(`missing ${webDist}/index.html`);
  }
}

async function buildDesktopSatellites(): Promise<{
  companionDist: string;
  codingDist: string;
  pomodoroFloatDist: string;
}> {
  process.env.FREEANIMA_SHELL_TARGET = "desktop";
  console.log("[prepare-tauri] build companion + coding + pomodoro-float (parallel)…");
  const [companionDist, codingDist, pomodoroFloatDist] = await Promise.all([
    buildCompanionApp({ minify: true }),
    buildCodingApp({ minify: true }),
    buildPomodoroFloatApp({ minify: true }),
  ]);
  return { companionDist, codingDist, pomodoroFloatDist };
}

process.env.FREEANIMA_SHELL_TARGET = target;
console.log(
  `[prepare-tauri] target=${target} parallel UI builds… (incremental=${incrementalEnabled})`,
);

type DesktopDists = {
  companionDist: string;
  codingDist: string;
  pomodoroFloatDist: string;
};

let desktopDists: DesktopDists | null = null;
try {
  if (target === "desktop") {
    const [, dists] = await Promise.all([buildWebDist(), buildDesktopSatellites()]);
    desktopDists = dists;
  } else {
    await buildWebDist();
  }
} catch (e) {
  console.error(`[prepare-tauri] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

if (existsSync(uiRoot)) rmSync(uiRoot, { recursive: true });
mkdirSync(uiWeb, { recursive: true });
cpSync(webDist, uiWeb, { recursive: true });
if (target === "desktop") {
  injectBootSplash(join(uiWeb, "index.html"), splashProductName);
}
writeNativeBuildMeta(uiWeb);
writeFileSync(
  join(uiRoot, "index.html"),
  `<!doctype html><meta http-equiv="refresh" content="0;url=web/index.html" /><script>location.replace("web/index.html"+location.hash)</script>\n`,
  "utf-8",
);
console.log(`[prepare-tauri] app-ui → ${uiWeb} (${target})`);

if (target === "desktop" && desktopDists) {
  mkdirSync(dirname(companionUi), { recursive: true });
  cpSync(desktopDists.companionDist, companionUi, { recursive: true });
  if (!existsSync(join(companionUi, "index.html"))) {
    console.error(`[prepare-tauri] missing ${companionUi}/index.html`);
    process.exit(1);
  }
  if (existsSync(legacyCompanionResource)) {
    rmSync(legacyCompanionResource, { recursive: true });
    mkdirSync(legacyCompanionResource, { recursive: true });
    writeFileSync(join(legacyCompanionResource, ".gitkeep"), "");
  }
  console.log(`[prepare-tauri] companion → ${companionUi} (frontendDist)`);

  mkdirSync(dirname(codingUi), { recursive: true });
  cpSync(desktopDists.codingDist, codingUi, { recursive: true });
  if (!existsSync(join(codingUi, "index.html"))) {
    console.error(`[prepare-tauri] missing ${codingUi}/index.html`);
    process.exit(1);
  }
  console.log(`[prepare-tauri] coding → ${codingUi} (frontendDist)`);

  mkdirSync(dirname(pomodoroFloatUi), { recursive: true });
  cpSync(desktopDists.pomodoroFloatDist, pomodoroFloatUi, { recursive: true });
  if (!existsSync(join(pomodoroFloatUi, "index.html"))) {
    console.error(`[prepare-tauri] missing ${pomodoroFloatUi}/index.html`);
    process.exit(1);
  }
  console.log(`[prepare-tauri] pomodoro-float → ${pomodoroFloatUi} (frontendDist)`);
} else {
  if (existsSync(legacyCompanionResource)) {
    rmSync(legacyCompanionResource, { recursive: true });
    mkdirSync(legacyCompanionResource, { recursive: true });
    writeFileSync(join(legacyCompanionResource, ".gitkeep"), "");
  }
  console.log("[prepare-tauri] skip companion/coding/pomodoro-float (mobile)");
}

writeStamp(fingerprint);
finishWithIdentity();
