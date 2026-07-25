#!/usr/bin/env bun
/**
 * 构建 Vault 浏览器扩展（WXT → dist/browser-extension）。
 * 用法：bun scripts/build-browser-extension.ts
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
await $`bunx wxt build`.cwd(root);
console.log("browser-extension → dist/browser-extension");
