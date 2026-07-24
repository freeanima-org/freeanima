#!/usr/bin/env bun
/**
 * 编译 Paraglide messages → messages/paraglide/。
 * 用法：bun scripts/paraglide-compile.ts
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
await $`bunx paraglide-js compile --project ./project.inlang --outdir ./messages/paraglide`.cwd(
  root,
);
