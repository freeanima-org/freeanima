#!/usr/bin/env bun
/**
 * 构建 Web UI dist（vite build → build-meta）。
 * 用法：
 *   bun scripts/build-web.ts
 *   FREEANIMA_SHELL_TARGET=desktop bun scripts/build-web.ts
 *   FREEANIMA_SHELL_TARGET=mobile bun scripts/build-web.ts
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

await $`bunx vite build`.cwd(join(root, "src/portal/app/web"));
await $`bun ${join(root, "scripts/write-web-build-meta.ts")}`.cwd(root);
