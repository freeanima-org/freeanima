#!/usr/bin/env bun
/**
 * 生成 component build-meta.json（service / web / native）。
 *
 * bun scripts/gen-build-meta.ts --component service --channel prod --out path/to/build-meta.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  createComponentBuildMeta,
  type BuildChannel,
  type BuildComponent,
  type NativeShellKind,
} from "@freeanima/core/config/build-meta.ts";
import { getRepoRoot } from "@freeanima/core/config/repo-root.ts";

function usage(): never {
  console.error(
    "Usage: bun scripts/gen-build-meta.ts --component service|web|native [--shell desktop|mobile] --channel prod|dev --out <path> [--repo-root <dir>]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]): {
  component: BuildComponent;
  shell?: NativeShellKind;
  channel: BuildChannel;
  out: string;
  repoRoot: string;
} {
  let component: BuildComponent | null = null;
  let shell: NativeShellKind | undefined;
  let channel: BuildChannel | null = null;
  let out: string | null = null;
  let repoRoot: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--component") {
      const v = argv[++i];
      if (v === "service" || v === "web" || v === "native") component = v;
      else usage();
    } else if (arg === "--shell") {
      const v = argv[++i];
      if (v === "desktop" || v === "mobile") shell = v;
      else usage();
    } else if (arg === "--channel") {
      const v = argv[++i];
      if (v === "prod" || v === "dev") channel = v;
      else usage();
    } else if (arg === "--out") {
      out = argv[++i] ?? null;
    } else if (arg === "--repo-root") {
      repoRoot = argv[++i] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    }
  }

  if (!component || !channel || !out) usage();

  return {
    component,
    ...(shell ? { shell } : {}),
    channel,
    out,
    repoRoot: repoRoot ?? getRepoRoot(),
  };
}

const args = parseArgs(process.argv.slice(2));
if (args.component === "native" && !args.shell) {
  console.error("native component requires --shell desktop|mobile");
  process.exit(1);
}
const meta = createComponentBuildMeta({
  component: args.component,
  ...(args.shell ? { shell: args.shell } : {}),
  channel: args.channel,
  repoRoot: args.repoRoot,
  includeBuiltAt: args.channel === "prod",
});

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`wrote ${args.out} (${meta.component}@${meta.version}, ${meta.channel})`);
