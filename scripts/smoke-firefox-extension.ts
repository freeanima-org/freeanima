#!/usr/bin/env bun
/**
 * Firefox 扩展打包冒烟（无 GUI）：校验 MV3 manifest / gecko / updates.json 约定。
 * Win 实机填充等需维护者本机安装签名 xpi 后手工确认。
 *
 * 用法：FREEANIMA_BUILD_CHANNEL=canary FREEANIMA_BUILD_VERSION=… bun scripts/smoke-firefox-extension.ts
 * 缺省先跑 pack（可 SMOKE_SKIP_PACK=1 跳过）。
 */
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  FIREFOX_ADDON_ID,
  FIREFOX_ADDON_UPDATE_URL,
  resolveFirefoxAddonVersion,
} from "@freeanima/habitat/core/config/firefox-addon.ts";
import { resolvePackArtifactMeta } from "@freeanima/habitat/core/config/pack-artifact-names.ts";
import { asRecord } from "@freeanima/shared/util";

const root = join(import.meta.dir, "..");
const firefoxDir = join(root, "dist/browser-extension/firefox-mv3");
const updatesPath = join(root, "dist/freeanima-browser-extension-firefox-updates.json");
const xpiPath = join(root, "dist/freeanima-browser-extension-firefox.xpi");

if (process.env.SMOKE_SKIP_PACK !== "1") {
  await $`just pack browser-extension-firefox`.cwd(root);
}

const meta = resolvePackArtifactMeta(root);
const expectedVersion = resolveFirefoxAddonVersion(meta.version);

if (!existsSync(firefoxDir)) throw new Error(`missing ${firefoxDir}`);
if (!existsSync(xpiPath)) throw new Error(`missing ${xpiPath}`);
if (!existsSync(updatesPath)) throw new Error(`missing ${updatesPath}`);

const manifest = asRecord(JSON.parse(await Bun.file(join(firefoxDir, "manifest.json")).text()));
if (!manifest) throw new Error("invalid manifest.json");
const gecko = asRecord(asRecord(manifest.browser_specific_settings)?.gecko);
const background = asRecord(manifest.background);

if (manifest.manifest_version !== 3) {
  throw new Error(`expected MV3, got ${String(manifest.manifest_version)}`);
}
if (manifest.version !== expectedVersion) {
  throw new Error(`version ${String(manifest.version)} != ${expectedVersion}`);
}
if (manifest.version_name) {
  throw new Error("firefox build must not include version_name");
}
if (gecko?.id !== FIREFOX_ADDON_ID) {
  throw new Error(`gecko.id mismatch: ${String(gecko?.id)}`);
}
if (gecko?.update_url !== FIREFOX_ADDON_UPDATE_URL) {
  throw new Error(`update_url mismatch`);
}
if (!background?.service_worker && !Array.isArray(background?.scripts)) {
  throw new Error("missing background entry");
}

const updatesRoot = asRecord(JSON.parse(await Bun.file(updatesPath).text()));
const addons = asRecord(updatesRoot?.addons);
const tipList = asRecord(addons?.[FIREFOX_ADDON_ID]);
const tipArr: unknown[] = Array.isArray(tipList?.updates) ? tipList.updates : [];
const tipRaw: unknown = tipArr[0];
const tip = asRecord(tipRaw);
const tipVersion = typeof tip?.version === "string" ? tip.version : undefined;
const tipLink = typeof tip?.update_link === "string" ? tip.update_link : "";
if (!tip || tipVersion !== expectedVersion) {
  throw new Error(`updates.json version mismatch: ${tipVersion}`);
}
if (!tipLink.includes("/releases/download/canary/")) {
  throw new Error(`updates.json must point at canary download: ${tipLink}`);
}

console.log("[smoke-firefox-extension] ok", {
  version: expectedVersion,
  id: FIREFOX_ADDON_ID,
  update_url: FIREFOX_ADDON_UPDATE_URL,
  xpi: xpiPath,
});
console.log(
  "[smoke-firefox-extension] Win 手工：安装签名 xpi → 连 Habitat → 填充/解锁；about:addons 检查更新",
);
