#!/usr/bin/env bun
/**
 * 构建浏览器形态入口 Chrome 扩展（WXT → dist/browser-extension）并打包为 .zip。
 * 用法：bun scripts/build-browser-extension-chrome.ts
 * 缺省 channel=local（版本 `{pkg}-local+UTC`）；CI 设 FREEANIMA_BUILD_CHANNEL + FREEANIMA_BUILD_VERSION。
 */
import { $ } from "bun";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { rmSync } from "node:fs";
import JSZip from "jszip";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const root = join(import.meta.dir, "..");
const extOutDir = join(root, "dist/browser-extension");
const chromeDir = join(extOutDir, "chrome-mv3");

/** 将目录内容打成 zip（条目在包根，与 `zip -r .` 一致；不依赖系统 zip） */
async function zipDirectoryContents(dir: string, outZip: string): Promise<void> {
  const zip = new JSZip();

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (entry.name.endsWith(".zip")) continue;
      const rel = relative(dir, full).split(sep).join("/");
      zip.file(rel, await readFile(full));
    }
  }

  await walk(dir);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(outZip, buf);
}

await $`bun x wxt build`.cwd(root);
console.log("browser-extension-chrome → dist/browser-extension");

// 将 chrome-mv3 目录打 zip 包
const zipSource = join(extOutDir, "freeanima-browser-extension.zip");
rmSync(zipSource, { force: true });
await zipDirectoryContents(chromeDir, zipSource);
console.log("browser-extension-chrome .zip →", zipSource);

// 按 pack artifact 命名规则写入版本化 + stable 副本
emitPackArtifact({
  kind: "browser-extension-zip",
  sourcePath: zipSource,
  logPrefix: "[pack browser-extension-chrome]",
});
