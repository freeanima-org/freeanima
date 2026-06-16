#!/usr/bin/env bun
/**
 * 本地安装 publish 形态的 @freeanima/cli：
 * - build-cli 产出 cli/publish/
 * - 清理 ~/.bun/install/global 中损坏/重复的 @freeanima/cli 记录
 * - bun pm pack + bun install -g <tarball>（避免 bun install -g ./cli/publish 的路径与重复依赖问题）
 */
import { $ } from "bun";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PUBLISH_DIR = join(ROOT, "cli/publish");

function bunGlobalDir(): string {
  const home = process.env.HOME;
  if (!home) throw new Error("install-cli-local: HOME is not set");
  const bunInstall = process.env.BUN_INSTALL ?? join(home, ".bun");
  return join(bunInstall, "install/global");
}

/** 移除损坏的全局 @freeanima/cli 依赖，避免 DependencyLoop / Duplicate key */
function resetGlobalCliInstall(): void {
  const globalDir = bunGlobalDir();
  const pkgPath = join(globalDir, "package.json");
  let deps: Record<string, string> = {};

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        dependencies?: Record<string, string>;
      };
      deps = { ...pkg.dependencies };
    } catch {
      /* 损坏的 package.json 直接重建 */
    }
  }

  delete deps[""];
  delete deps["@freeanima/cli"];

  mkdirSync(globalDir, { recursive: true });
  writeFileSync(
    pkgPath,
    `${JSON.stringify({ name: "bun-global", dependencies: deps }, null, 2)}\n`,
  );
  rmSync(join(globalDir, "bun.lock"), { force: true });
  rmSync(join(globalDir, "node_modules/@freeanima"), { recursive: true, force: true });
}

function findPackedTarball(): string {
  const files = readdirSync(PUBLISH_DIR).filter((name) => name.endsWith(".tgz"));
  if (files.length === 0) {
    throw new Error("install-cli-local: bun pm pack did not produce a .tgz in cli/publish");
  }
  return join(PUBLISH_DIR, files.toSorted().at(-1)!);
}

async function main(): Promise<void> {
  console.log("building cli…");
  await $`bun ${join(ROOT, "scripts/build-cli.ts")}`;

  resetGlobalCliInstall();

  console.log("packing cli…");
  await $`cd ${PUBLISH_DIR} && bun pm pack`;

  const tarball = findPackedTarball();
  console.log(`installing ${tarball} globally…`);
  await $`bun install -g ${tarball}`;

  console.log("done — run `anima --help` to verify");
}

await main();
