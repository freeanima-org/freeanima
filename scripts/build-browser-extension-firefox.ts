#!/usr/bin/env bun
/**
 * 构建浏览器形态入口 Firefox 扩展（WXT -b firefox）并产出可上传的 .xpi + updates.json。
 *
 * - 有 FREEANIMA_AMO_API_KEY + FREEANIMA_AMO_API_SECRET → web-ext sign（unlisted）
 * - 否则打未签名 zip 命名为 .xpi（仅供 about:debugging 临时加载；不可用于正式自动更新）
 *
 * 用法：bun scripts/build-browser-extension-firefox.ts
 * 环境：FREEANIMA_BUILD_CHANNEL / FREEANIMA_BUILD_VERSION（与 Chrome pack 相同）
 */
import { $ } from "bun";
import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { emitPackArtifact } from "./emit-pack-artifact.ts";
import {
  FIREFOX_ADDON_UPDATES_ASSET_NAME,
  buildFirefoxAddonUpdatesJson,
  resolveFirefoxAddonVersion,
} from "@freeanima/host/core/config/firefox-addon.ts";
import { resolvePackArtifactMeta } from "@freeanima/host/core/config/pack-artifact-names.ts";

const root = join(import.meta.dir, "..");
const extOutDir = join(root, "dist/browser-extension");
const firefoxDir = join(extOutDir, "firefox-mv3");
const artifactsDir = join(extOutDir, "firefox-artifacts");

async function zipDirectoryAsXpi(dir: string, outXpi: string): Promise<void> {
  const zip = new JSZip();

  async function walk(current: string, prefix = ""): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      zip.file(rel, await readFile(full));
    }
  }

  await walk(dir);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(outXpi, buf);
}

function resolveAmoCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey =
    process.env.FREEANIMA_AMO_API_KEY?.trim() || process.env.WEB_EXT_API_KEY?.trim() || "";
  const apiSecret =
    process.env.FREEANIMA_AMO_API_SECRET?.trim() || process.env.WEB_EXT_API_SECRET?.trim() || "";
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

async function signWithWebExt(sourceDir: string, outDir: string): Promise<string> {
  const creds = resolveAmoCredentials();
  if (!creds) throw new Error("missing AMO API credentials");

  rmSync(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await $`bun x web-ext@8 sign --channel=unlisted --source-dir=${sourceDir} --artifacts-dir=${outDir} --api-key=${creds.apiKey} --api-secret=${creds.apiSecret}`.cwd(
    root,
  );

  const files = (await readdir(outDir)).filter((n) => n.endsWith(".xpi"));
  if (files.length === 0) {
    throw new Error(`web-ext sign produced no .xpi in ${outDir}`);
  }
  // 取最新修改的（通常仅一个）
  files.sort();
  const signed = files.at(-1);
  if (!signed) {
    throw new Error(`web-ext sign produced no .xpi in ${outDir}`);
  }
  return join(outDir, signed);
}

const meta = resolvePackArtifactMeta(root);
const addonVersion = resolveFirefoxAddonVersion(meta.version);

await $`bun x wxt build -b firefox --mv3`.cwd(root);
if (!existsSync(firefoxDir)) {
  throw new Error(`firefox build missing: ${firefoxDir}`);
}

// 核对 manifest.version
const manifest = JSON.parse(await readFile(join(firefoxDir, "manifest.json"), "utf8")) as {
  version?: string;
  browser_specific_settings?: { gecko?: { id?: string; update_url?: string } };
};
if (manifest.version !== addonVersion) {
  throw new Error(
    `firefox manifest.version mismatch: built=${manifest.version} expected=${addonVersion}`,
  );
}
if (!manifest.browser_specific_settings?.gecko?.id) {
  throw new Error("firefox manifest missing browser_specific_settings.gecko.id");
}

await mkdir(artifactsDir, { recursive: true });
const unsignedPath = join(artifactsDir, "unsigned.xpi");
const creds = resolveAmoCredentials();
let xpiSource: string;
let signed = false;

if (creds) {
  console.log("[pack browser-extension-firefox] signing with AMO (unlisted)…");
  xpiSource = await signWithWebExt(firefoxDir, join(artifactsDir, "signed"));
  signed = true;
} else {
  console.warn(
    "[pack browser-extension-firefox] FREEANIMA_AMO_API_KEY/SECRET 未设置：产出未签名 xpi（不可用于正式自动更新）",
  );
  await zipDirectoryAsXpi(firefoxDir, unsignedPath);
  xpiSource = unsignedPath;
}

emitPackArtifact({
  kind: "browser-extension-firefox-xpi",
  sourcePath: xpiSource,
  logPrefix: "[pack browser-extension-firefox]",
  includeLegacyAliases: false,
});

const updatesJson = buildFirefoxAddonUpdatesJson(addonVersion);
const updatesTmp = join(artifactsDir, FIREFOX_ADDON_UPDATES_ASSET_NAME);
await writeFile(updatesTmp, updatesJson);
emitPackArtifact({
  kind: "browser-extension-firefox-updates",
  sourcePath: updatesTmp,
  logPrefix: "[pack browser-extension-firefox]",
  includeLegacyAliases: false,
});

// 便于本机检查
await copyFile(
  join(root, "dist", "freeanima-browser-extension-firefox-updates.json"),
  join(extOutDir, "firefox-updates.json"),
);

console.log(
  `[pack browser-extension-firefox] addonVersion=${addonVersion} signed=${signed} channel=${meta.channel}`,
);
