#!/usr/bin/env bun
/**
 * 将 `dist/anima-executable/anima` 安装到独立前缀（默认 `~/.anima/standalone`），
 * 写入 `anima_<version>`，`anima` symlink 指向当前版，并在 `~/.local/bin/anima` 放置 PATH shim。
 *
 * 用法：
 *   just install cli
 *   bun scripts/install-cli.ts [--prefix DIR] [--skip-build]
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  assertSafeStandaloneInstallPrefix,
  installVersionedBinary,
  migrateFlatAnimaFileIfNeeded,
  resolveInstallPrefixFromEnv,
} from "@freeanima/habitat/core/config/install-prefix";
import { resolveMonorepoRoot } from "@freeanima/habitat/core/config/repo-root";
import { readAppVersion } from "@freeanima/habitat/core/config/version";

const ROOT = resolveMonorepoRoot(import.meta.dir) ?? join(import.meta.dir, "..");
const STAGING_ANIMA = join(ROOT, "dist/anima-executable/anima");

function parseArgs(argv: string[]): { prefix?: string; skipBuild: boolean } {
  let prefix: string | undefined;
  let skipBuild = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--skip-build") skipBuild = true;
    else if (a === "--prefix") {
      prefix = argv[++i];
      if (!prefix) throw new Error("--prefix 需要目录参数");
    } else if (a?.startsWith("--prefix=")) {
      prefix = a.slice("--prefix=".length);
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: bun scripts/install-cli.ts [--prefix DIR] [--skip-build]

安装单文件 standalone 到独立前缀（禁止 monorepo 内）。
默认前缀: ~/.anima/standalone（或 FREEANIMA_INSTALL_PREFIX）
版本文件: anima_<version>；当前链接: anima
PATH 入口: ~/.local/bin/anima
`);
      process.exit(0);
    }
  }
  return { ...(prefix ? { prefix } : {}), skipBuild };
}

function requireStaging(): void {
  if (!existsSync(STAGING_ANIMA)) {
    throw new Error(`缺少构建产物 ${STAGING_ANIMA}。请先执行: just pack cli`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.skipBuild) {
    console.log(
      "提示: 完整流程请用 `just install cli`（会先 just pack cli）。--skip-build 仅重装已有 dist。",
    );
  }

  requireStaging();

  const prefix = resolve(args.prefix ?? resolveInstallPrefixFromEnv());
  assertSafeStandaloneInstallPrefix(prefix, { monorepoRoot: resolveMonorepoRoot(ROOT) });

  const versionId = readAppVersion(ROOT);
  if (migrateFlatAnimaFileIfNeeded(prefix, versionId)) {
    console.log(`migrated flat anima → anima_${versionId}`);
  }
  console.log(`installing single-file anima → ${prefix} (version ${versionId})`);
  const result = installVersionedBinary(prefix, STAGING_ANIMA, versionId);
  console.log(`versioned binary → ${result.versionPath}`);
  console.log(`current link → ${result.currentLink}`);
  if (result.pruned.length > 0) {
    console.log(`pruned old versions: ${result.pruned.join(", ")}`);
  }
  console.log(`done. Ensure PATH includes ~/.local/bin then: anima --version`);
}

await main();
