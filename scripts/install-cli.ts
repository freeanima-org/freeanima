#!/usr/bin/env bun
/**
 * 将 `dist/anima-executable/anima` 安装到独立前缀（默认 `~/.anima/standalone`），
 * 并在 `~/.anima/bin/anima` 放置指向已安装二进制的 symlink。
 *
 * 用法：
 *   just install-cli
 *   bun scripts/install-cli.ts [--prefix DIR] [--skip-build]
 */
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  animaBinShimPath,
  assertSafeStandaloneInstallPrefix,
  defaultAnimaBinDir,
  resolveInstallPrefixFromEnv,
} from "@freeanima/core/config/install-prefix";
import { resolveMonorepoRoot } from "@freeanima/core/config/repo-root";

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
PATH 入口: ~/.anima/bin/anima
`);
      process.exit(0);
    }
  }
  return { ...(prefix ? { prefix } : {}), skipBuild };
}

function requireStaging(): void {
  if (!existsSync(STAGING_ANIMA)) {
    throw new Error(`缺少构建产物 ${STAGING_ANIMA}。请先执行: just build-cli`);
  }
}

function installBinary(prefix: string): void {
  mkdirSync(prefix, { recursive: true });
  const destAnima = join(prefix, "anima");
  cpSync(STAGING_ANIMA, destAnima);
  chmodSync(destAnima, 0o755);
}

function linkBinShim(prefix: string): string {
  const binDir = defaultAnimaBinDir();
  mkdirSync(binDir, { recursive: true });
  const shim = animaBinShimPath(binDir);
  const target = join(prefix, "anima");
  rmSync(shim, { force: true });
  symlinkSync(target, shim);
  return shim;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.skipBuild) {
    console.log(
      "提示: 完整流程请用 `just install-cli`（会先 build-cli）。--skip-build 仅重装已有 dist。",
    );
  }

  requireStaging();

  const prefix = resolve(args.prefix ?? resolveInstallPrefixFromEnv());
  assertSafeStandaloneInstallPrefix(prefix, { monorepoRoot: resolveMonorepoRoot(ROOT) });

  console.log(`installing single-file anima → ${prefix}`);
  installBinary(prefix);
  const shim = linkBinShim(prefix);
  console.log(`bin shim → ${shim} -> ${join(prefix, "anima")}`);
  console.log(`done. Ensure PATH includes ${dirname(shim)} then: anima --version`);
}

await main();
