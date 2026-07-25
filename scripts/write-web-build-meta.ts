#!/usr/bin/env bun
/**
 * 按 FREEANIMA_SHELL_TARGET 向对应 web outDir 写入 build-meta.json。
 * 供 `scripts/build-web.ts`（just pack web）在 vite build 之后调用。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseShellBuildTarget,
  shellWebDistDirName,
} from "@freeanima/client/portal-sdk/shell-build-target.ts";
import {
  createComponentBuildMeta,
  isShipChannel,
  resolveBuildChannelFromEnv,
} from "@freeanima/host/core/config/build-meta.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = parseShellBuildTarget(process.env.FREEANIMA_SHELL_TARGET);
const out = join(root, "src/portal/app/web", shellWebDistDirName(target), "build-meta.json");
const channel = resolveBuildChannelFromEnv("dev");
const meta = createComponentBuildMeta({
  component: "web",
  channel,
  repoRoot: root,
  includeBuiltAt: isShipChannel(channel),
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(meta, null, 2)}\n`, "utf-8");
console.log(`[build:web] build-meta → ${out} (shellTarget=${target})`);
