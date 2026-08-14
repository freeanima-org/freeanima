#!/usr/bin/env bun
/**
 * 构建 Web UI dist（vite build → build-meta）。
 * 用法：
 *   bun scripts/build-web.ts
 *   FREEANIMA_SHELL_TARGET=desktop bun scripts/build-web.ts
 *   FREEANIMA_SHELL_TARGET=mobile bun scripts/build-web.ts
 */
import { $ } from "bun";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const WEB_DIST_DIR = join(root, "packages/frontend/portal/app/web/dist");
/** vite emptyOutDir 会清掉占位文件；构建后写回，保证 dir: / oxlint 目录仍在仓内契约 */
const WEB_DIST_GITIGNORE = `*\n!.gitignore\n`;

await $`bun x vite build`.cwd(join(root, "packages/frontend/portal/app/web"));
await $`bun ${join(root, "scripts/write-web-build-meta.ts")}`.cwd(root);
writeFileSync(join(WEB_DIST_DIR, ".gitignore"), WEB_DIST_GITIGNORE);
