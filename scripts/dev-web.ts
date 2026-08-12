#!/usr/bin/env bun
/**
 * Vite Web 开发服。
 * 用法：bun scripts/dev-web.ts [-- …vite args]
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const viteArgs = process.argv.slice(2);
await $`bun x vite ${viteArgs}`.cwd(join(root, "src/portal/app/web"));
