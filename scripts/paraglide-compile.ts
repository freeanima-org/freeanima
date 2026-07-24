#!/usr/bin/env bun
/**
 * 编译 Paraglide messages → messages/paraglide/（产品 UI catalog）。
 * Site landing 另用：bun scripts/paraglide-compile-site.ts
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
await $`bunx paraglide-js compile --project ./project.inlang --outdir ./messages/paraglide`.cwd(
  root,
);
