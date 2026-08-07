#!/usr/bin/env bun
/**
 * 构建 Vault 浏览器扩展（WXT → dist/browser-extension）并打包为 .zip。
 * 用法：bun scripts/build-browser-extension.ts
 */
import { $ } from "bun";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const root = join(import.meta.dir, "..");
const extOutDir = join(root, "dist/browser-extension");
const chromeDir = join(extOutDir, "chrome-mv3");

// ui-kit/composite 经 @paraglide/messages；与 just pack web 一样先编译 catalog
await $`bun ${join(root, "scripts/paraglide-compile.ts")}`.cwd(root);
await $`bunx wxt build`.cwd(root);
console.log("browser-extension → dist/browser-extension");

// 将 chrome-mv3 目录打 zip 包
const zipSource = join(extOutDir, "freeanima-browser-extension.zip");
rmSync(zipSource, { force: true });
await $`zip -r ${zipSource} . -x "*.zip"`.cwd(chromeDir);
console.log("browser-extension .zip →", zipSource);

// 按 pack artifact 命名规则写入版本化 + stable 副本
emitPackArtifact({
  kind: "browser-extension-zip",
  sourcePath: zipSource,
  logPrefix: "[pack browser-extension]",
});
