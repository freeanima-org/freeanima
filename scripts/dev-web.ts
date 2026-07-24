#!/usr/bin/env bun
/**
 * Vite Web 开发服（先 paraglide compile）。
 * 用法：bun scripts/dev-web.ts [-- …vite args]
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
await $`bun ${join(root, "scripts/paraglide-compile.ts")}`.cwd(root);

const viteArgs = process.argv.slice(2);
await $`bunx vite ${viteArgs}`.cwd(join(root, "src/app/shell/web"));
