import type { Command } from "commander";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { applyStandaloneUpgrade } from "@freeanima/core/config/app-update/apply-standalone-upgrade";
import {
  CLI_UPGRADE_HINT_SOURCE,
  CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX,
  getCliInstallKind,
} from "@freeanima/core/config/cli-install";
import {
  assertSafeStandaloneInstallPrefix,
  isPathInsideMonorepo,
  resolveStandalonePrefixFromExec,
} from "@freeanima/core/config/install-prefix";
import { readAppVersion } from "@freeanima/core/config/version";
import { getStandaloneRuntimeMeta } from "@freeanima/core/config/standalone-runtime-meta";
import { resolveMonorepoRoot } from "@freeanima/core/config/repo-root";

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

function exitWith(code: number): never {
  process.exit(code);
}

export async function runCliUpgrade(opts?: {
  scriptPath?: string;
  checkOnly?: boolean;
}): Promise<void> {
  const kind = getCliInstallKind(opts?.scriptPath);
  if (kind !== "standalone") {
    console.error(CLI_UPGRADE_HINT_SOURCE);
    exitWith(1);
  }

  const execPath = process.execPath;
  const prefix = resolveStandalonePrefixFromExec(execPath);
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

  let localVersion: string;
  try {
    localVersion = getStandaloneRuntimeMeta()?.version ?? readAppVersion();
  } catch {
    localVersion = "0.0.0";
  }

  const animaBin = join(prefix, "anima");
  const checkOnly = Boolean(opts?.checkOnly);

  if (!checkOnly) {
    tryStopService(animaBin);
  }

  const result = await applyStandaloneUpgrade({
    prefix,
    localVersion,
    checkOnly,
    log: (msg) => console.error(msg),
  });

  switch (result.status) {
    case "up_to_date":
      console.error(
        result.remoteVersion
          ? `已是最新（本地 ${localVersion}，远端 ${result.remoteVersion}）`
          : `已是最新（本地 ${localVersion}）`,
      );
      exitWith(0);
    case "no_release":
      console.error("无法获取 GitHub Releases（网络或限流）。请稍后重试。");
      exitWith(1);
    case "no_asset":
      console.error(`远端 ${result.remoteVersion ?? "?"} 尚无 anima-linux-x64.tar.gz，跳过升级。`);
      exitWith(1);
    case "would_upgrade":
      console.error(`有新版本 ${result.remoteVersion}: ${result.assetUrl}`);
      exitWith(0);
    case "upgraded":
      console.error(`已升级到 ${result.remoteVersion}（前缀 ${result.prefix}）`);
      tryStartService(join(result.prefix, "anima"));
      exitWith(0);
    default: {
      const _exhaustive: never = result;
      void _exhaustive;
      exitWith(1);
    }
  }
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade")
    .description("standalone：从 GitHub Releases 下载并覆盖独立安装前缀；源码安装仅打印指引")
    .option("--check", "仅检查是否有新版本，不下载安装")
    .action(async (options: { check?: boolean }) => {
      await runCliUpgrade({ checkOnly: Boolean(options.check) });
    });
}
