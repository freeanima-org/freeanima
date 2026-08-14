import type { Command } from "commander";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { applyStandaloneUpgrade } from "@freeanima/habitat/core/config/app-update/apply-standalone-upgrade";
import {
  isGithubReleaseProxyId,
  type GithubReleaseProxyId,
} from "@freeanima/habitat/core/config/app-update/github-release-proxy";
import {
  isSwitchableChannel,
  normalizeBuildChannel,
  type BuildChannel,
} from "@freeanima/habitat/core/config/build-meta";
import {
  CLI_UPGRADE_HINT_SOURCE,
  CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX,
  getCliInstallKind,
} from "@freeanima/habitat/core/config/cli-install";
import {
  assertSafeStandaloneInstallPrefix,
  isPathInsideMonorepo,
  resolveStandalonePrefixFromExec,
} from "@freeanima/habitat/core/config/install-prefix";
import { readAppVersion } from "@freeanima/habitat/core/config/version";
import { getStandaloneRuntimeMeta } from "@freeanima/habitat/core/config/standalone-runtime-meta";
import { resolveMonorepoRoot } from "@freeanima/habitat/core/config/repo-root";
import { isServerAlive } from "@freeanima/habitat/platform/alive.ts";

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

function resolveBakedChannel(): BuildChannel {
  return getStandaloneRuntimeMeta()?.buildMeta?.channel ?? "release";
}

export async function runCliUpgrade(opts?: {
  scriptPath?: string;
  checkOnly?: boolean;
  /** 目标轨：省略则通道内更新；指定则换轨（check 时仅报告） */
  channel?: string;
  /** 公共 GitHub Release 反代；默认直连 */
  proxy?: string;
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

  const bakedChannel = resolveBakedChannel();
  if (!isSwitchableChannel(bakedChannel)) {
    console.error(
      `当前 channel 为 ${bakedChannel}，无法从 GitHub 升级。请安装 release 或 canary 独立包后再试。`,
    );
    exitWith(1);
  }

  let proxy: GithubReleaseProxyId = "none";
  if (opts?.proxy != null && opts.proxy.trim() !== "") {
    const raw = opts.proxy.trim();
    if (!isGithubReleaseProxyId(raw)) {
      console.error(
        `无效 --proxy（须为 none | ghproxy-net | gh-proxy-com | ghfast-top）：${opts.proxy}`,
      );
      exitWith(1);
    }
    proxy = raw;
  }

  let targetChannel: BuildChannel | undefined;
  let intent: "check" | "switch" = "check";
  if (opts?.channel != null && opts.channel.trim() !== "") {
    const parsed = normalizeBuildChannel(opts.channel.trim());
    if (!parsed || !isSwitchableChannel(parsed)) {
      console.error(`无效 --channel（须为 release 或 canary）：${opts.channel}`);
      exitWith(1);
    }
    if (parsed !== bakedChannel) {
      intent = "switch";
      targetChannel = parsed;
    }
  }

  let localVersion: string;
  try {
    localVersion = getStandaloneRuntimeMeta()?.version ?? readAppVersion();
  } catch {
    localVersion = "0.0.0";
  }
  const localCommit =
    getStandaloneRuntimeMeta()?.buildMeta?.git?.commit_full ??
    getStandaloneRuntimeMeta()?.buildMeta?.git?.commit;

  const animaBin = join(prefix, "anima");
  const checkOnly = Boolean(opts?.checkOnly);

  let wasRunning = false;
  const result = await applyStandaloneUpgrade({
    prefix,
    localVersion,
    channel: bakedChannel,
    ...(localCommit ? { localCommit } : {}),
    intent,
    ...(targetChannel ? { targetChannel } : {}),
    checkOnly,
    fetchOptions: { proxy },
    beforeReplace: async () => {
      wasRunning = isServerAlive() != null;
      if (wasRunning) tryStopService(animaBin);
    },
    log: (msg) => console.error(msg),
  });

  switch (result.status) {
    case "up_to_date":
      console.error(
        result.remoteVersion
          ? `已是最新（channel ${bakedChannel}，本地 ${localVersion}，远端 ${result.remoteVersion}）`
          : `已是最新（channel ${bakedChannel}，本地 ${localVersion}）`,
      );
      exitWith(0);
    case "no_release":
      console.error("无法获取 GitHub Releases（网络或限流）。请稍后重试。");
      exitWith(1);
    case "no_asset":
      console.error(`远端 ${result.remoteVersion ?? "?"} 尚无 anima-linux-x64.tar.gz，跳过升级。`);
      exitWith(1);
    case "would_upgrade":
      console.error(
        intent === "switch"
          ? `可切换到 ${targetChannel}：${result.remoteVersion} ${result.assetUrl}`
          : `有新版本 ${result.remoteVersion}: ${result.assetUrl}`,
      );
      exitWith(0);
    case "upgraded":
      console.error(
        intent === "switch"
          ? `已切换到 ${targetChannel} ${result.remoteVersion}（前缀 ${result.prefix}）`
          : `已升级到 ${result.remoteVersion}（前缀 ${result.prefix}）`,
      );
      if (wasRunning) tryStartService(join(result.prefix, "anima"));
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
    .description(
      "standalone：从 GitHub Releases 按 channel 升级；--channel release|canary 可换轨；--proxy 可选公共反代；源码/local 仅打印指引",
    )
    .option("--check", "仅检查是否有新版本，不下载安装")
    .option("--channel <name>", "release 或 canary（与当前不同时视为换轨）")
    .option(
      "--proxy <id>",
      "none | ghproxy-net | gh-proxy-com | ghfast-top（默认 none，直连 GitHub）",
    )
    .action(async (options: { check?: boolean; channel?: string; proxy?: string }) => {
      await runCliUpgrade({
        checkOnly: Boolean(options.check),
        ...(options.channel != null ? { channel: options.channel } : {}),
        ...(options.proxy != null ? { proxy: options.proxy } : {}),
      });
    });
}
