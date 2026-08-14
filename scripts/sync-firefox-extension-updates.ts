#!/usr/bin/env bun
/**
 * 将 canary Release 上的 Firefox updates.json 同步到 site/public（对齐 sync-install）。
 *
 * 优先拉取：
 *   https://github.com/freeanima-org/freeanima/releases/download/canary/freeanima-browser-extension-firefox-updates.json
 * 失败时（本地无网 / 尚未发运）写入占位 JSON（version 0.0.0），避免 site build 中断。
 *
 * 用法：bun scripts/sync-firefox-extension-updates.ts
 * 或：cd site && bun run sync-firefox-updates
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIREFOX_ADDON_CANARY_UPDATES_ASSET_URL,
  FIREFOX_ADDON_ID,
  FIREFOX_ADDON_UPDATE_URL,
  buildFirefoxAddonUpdatesJson,
} from "@freeanima/habitat/core/config/firefox-addon.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "site/public/extension/firefox/updates.json");

async function fetchCanaryUpdates(): Promise<string | null> {
  try {
    const res = await fetch(FIREFOX_ADDON_CANARY_UPDATES_ASSET_URL, {
      headers: { "User-Agent": "freeanima-sync-firefox-extension-updates" },
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(`[sync-firefox-updates] HTTP ${res.status} from canary asset`);
      return null;
    }
    const text = await res.text();
    const parsed = JSON.parse(text) as { addons?: Record<string, unknown> };
    if (!parsed.addons?.[FIREFOX_ADDON_ID]) {
      console.warn("[sync-firefox-updates] canary JSON missing addon id");
      return null;
    }
    return text.endsWith("\n") ? text : `${text}\n`;
  } catch (err) {
    console.warn(
      `[sync-firefox-updates] fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

await mkdir(dirname(outPath), { recursive: true });
const remote = await fetchCanaryUpdates();
const body = remote ?? buildFirefoxAddonUpdatesJson("0.0.0");
await writeFile(outPath, body);
console.log(`[sync-firefox-updates] → ${outPath}${remote ? " (canary)" : " (placeholder 0.0.0)"}`);
console.log(`[sync-firefox-updates] public URL: ${FIREFOX_ADDON_UPDATE_URL}`);
