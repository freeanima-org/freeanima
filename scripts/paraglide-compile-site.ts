#!/usr/bin/env bun
/**
 * 编译 Site landing Paraglide → messages/paraglide-site/
 */
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
await $`bunx paraglide-js compile --project ./project.inlang.site --outdir ./messages/paraglide-site`.cwd(
  root,
);
