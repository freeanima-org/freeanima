import type { Command } from "commander";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  CLI_UPGRADE_HINT_SOURCE,
  CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX,
  getCliInstallKind,
} from "@freeanima/core/config/cli-install";
import {
  assertSafeStandaloneInstallPrefix,
  getCurrentVersionId,
  isPathInsideMonorepo,
  listInstalledVersions,
  resolveStandalonePrefixFromExec,
  setCurrentVersion,
} from "@freeanima/core/config/install-prefix";
import { resolveMonorepoRoot } from "@freeanima/core/config/repo-root";
import { isServerAlive } from "@freeanima/platform/alive.ts";

function exitWith(code: number): never {
  process.exit(code);
}

function tryStopService(animaPath: string): void {
  console.error("正在停止 service（若在运行）…");
  spawnSync(animaPath, ["service", "stop"], { stdio: "inherit" });
}

function tryStartService(animaPath: string): void {
  console.error("正在启动 service…");
  const r = spawnSync(animaPath, ["service", "start"], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`自动启动失败。请手动执行: ${animaPath} service start`);
  }
}

function resolvePrefixOrExit(): string {
  const kind = getCliInstallKind();
  if (kind !== "standalone") {
    console.error(CLI_UPGRADE_HINT_SOURCE);
    exitWith(1);
  }
  const prefix = resolveStandalonePrefixFromExec(process.execPath);
  if (!prefix) {
    console.error(CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX);
    exitWith(1);
  }
  try {
    assertSafeStandaloneInstallPrefix(prefix, {
      monorepoRoot: resolveMonorepoRoot(process.cwd()),
    });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX);
    exitWith(1);
  }
  if (isPathInsideMonorepo(prefix)) {
    console.error(CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX);
    exitWith(1);
  }
  return prefix;
}

export function runVersionsList(): void {
  const prefix = resolvePrefixOrExit();
  const current = getCurrentVersionId(prefix);
  const versions = listInstalledVersions(prefix);
  if (versions.length === 0) {
    console.error(`未找到已安装版本（${prefix}/anima_*）`);
    exitWith(1);
  }
  for (const v of versions) {
    const mark = current != null && v.id === current ? "* " : "  ";
    console.log(`${mark}${v.id}`);
  }
  if (current != null) {
    console.error(`current: ${current}`);
  }
  exitWith(0);
}

export function runVersionsUse(versionId: string): void {
  const prefix = resolvePrefixOrExit();
  const animaBin = join(prefix, "anima");
  const wasRunning = isServerAlive() != null;
  if (wasRunning) tryStopService(animaBin);

  try {
    setCurrentVersion(prefix, versionId);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    if (wasRunning) tryStartService(animaBin);
    exitWith(1);
  }

  console.error(`已切换到 ${versionId}（${animaBin}）`);
  if (wasRunning) tryStartService(animaBin);
  exitWith(0);
}

export function registerVersionsCommand(program: Command): void {
  const versions = program
    .command("versions")
    .description("standalone：列出本机已安装的 anima_<version>；use 切换当前版")
    .action(() => {
      runVersionsList();
    });

  versions
    .command("use")
    .argument("<id>", "版本 id（如 0.9.2，对应文件 anima_0.9.2）")
    .description("切换 current symlink 到指定本机版本")
    .action((id: string) => {
      runVersionsUse(id);
    });
}
