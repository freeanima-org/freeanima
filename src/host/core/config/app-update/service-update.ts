/**
 * 运行中 Habitat 进程的 standalone 服务升级（检查 / 应用）。
 * 供 Habitat RPC 与 ops ToolSet 共用。
 */
import {
  CLI_UPGRADE_HINT_SOURCE,
  CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX,
  getCliInstallKind,
  type CliInstallKind,
} from "../cli-install.ts";
import {
  assertSafeStandaloneInstallPrefix,
  isPathInsideMonorepo,
  resolveStandalonePrefixFromExec,
} from "../install-prefix.ts";
import { resolveMonorepoRoot } from "../repo-root.ts";
import { getStandaloneRuntimeMeta } from "../standalone-runtime-meta.ts";
import { readAppVersion } from "../version.ts";
import { isSwitchableChannel, type BuildChannel } from "../build-meta.parse.ts";
import {
  isGithubReleaseProxyId,
  normalizeGithubReleaseProxy,
  type GithubReleaseProxyId,
} from "./github-release-proxy.ts";
import { applyStandaloneUpgrade } from "./apply-standalone-upgrade.ts";

export type ServiceUpdateProxy = GithubReleaseProxyId;

export type ServiceUpdateCheckResult =
  | {
      ok: true;
      install_kind: CliInstallKind;
      upgradable: false;
      reason:
        | "source"
        | "unsafe_prefix"
        | "unsupported_channel"
        | "up_to_date"
        | "no_release"
        | "no_asset";
      hint?: string;
      localVersion?: string;
      remoteVersion?: string;
      channel?: BuildChannel;
    }
  | {
      ok: true;
      install_kind: "standalone";
      upgradable: true;
      localVersion: string;
      remoteVersion: string;
      assetUrl: string;
      channel: BuildChannel;
    };

export type ServiceUpdateApplyResult =
  | {
      ok: false;
      install_kind: CliInstallKind;
      reason:
        | "source"
        | "unsafe_prefix"
        | "unsupported_channel"
        | "up_to_date"
        | "no_release"
        | "no_asset"
        | "error";
      hint?: string;
      message?: string;
      remoteVersion?: string;
    }
  | {
      ok: true;
      install_kind: "standalone";
      remoteVersion: string;
      code: "service_restarting";
    };

export type ServiceUpdateOpts = {
  proxy?: unknown;
  /** 单测注入；默认 schedule 由调用方在 apply 成功后处理 */
  log?: (msg: string) => void;
};

function resolveProxy(raw: unknown): GithubReleaseProxyId {
  if (raw == null || raw === "") return "none";
  if (isGithubReleaseProxyId(raw)) return raw;
  return normalizeGithubReleaseProxy(raw);
}

type ResolvedStandaloneContext =
  | { ok: false; reason: "source"; hint: string }
  | { ok: false; reason: "unsafe_prefix"; hint: string }
  | {
      ok: false;
      reason: "unsupported_channel";
      hint: string;
      channel: BuildChannel;
      localVersion: string;
    }
  | {
      ok: true;
      prefix: string;
      channel: BuildChannel;
      localVersion: string;
      localCommit?: string;
    };

function resolveStandaloneContext(): ResolvedStandaloneContext {
  const kind = getCliInstallKind();
  if (kind !== "standalone") {
    return { ok: false, reason: "source", hint: CLI_UPGRADE_HINT_SOURCE };
  }

  const prefix = resolveStandalonePrefixFromExec(process.execPath);
  if (!prefix) {
    return { ok: false, reason: "unsafe_prefix", hint: CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX };
  }

  try {
    assertSafeStandaloneInstallPrefix(prefix, {
      monorepoRoot: resolveMonorepoRoot(process.cwd()),
    });
  } catch {
    return { ok: false, reason: "unsafe_prefix", hint: CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX };
  }

  if (isPathInsideMonorepo(prefix)) {
    return { ok: false, reason: "unsafe_prefix", hint: CLI_UPGRADE_HINT_STANDALONE_UNSAFE_PREFIX };
  }

  const channel: BuildChannel = getStandaloneRuntimeMeta()?.buildMeta?.channel ?? "release";
  let localVersion: string;
  try {
    localVersion = getStandaloneRuntimeMeta()?.version ?? readAppVersion();
  } catch {
    localVersion = "0.0.0";
  }

  if (!isSwitchableChannel(channel)) {
    return {
      ok: false,
      reason: "unsupported_channel",
      hint: `当前 channel 为 ${channel}，无法从 GitHub 升级。请安装 release 或 canary 独立包后再试。`,
      channel,
      localVersion,
    };
  }

  const localCommit =
    getStandaloneRuntimeMeta()?.buildMeta?.git?.commit_full ??
    getStandaloneRuntimeMeta()?.buildMeta?.git?.commit;

  return {
    ok: true,
    prefix,
    channel,
    localVersion,
    ...(localCommit ? { localCommit } : {}),
  };
}

/** 检查栖息地服务是否有可安装的 standalone 更新 */
export async function checkServiceUpdate(
  opts?: ServiceUpdateOpts,
): Promise<ServiceUpdateCheckResult> {
  const proxy = resolveProxy(opts?.proxy);
  const kind = getCliInstallKind();
  const ctx = resolveStandaloneContext();

  if (!ctx.ok) {
    if (ctx.reason === "source") {
      return {
        ok: true,
        install_kind: kind,
        upgradable: false,
        reason: "source",
        hint: ctx.hint,
      };
    }
    if (ctx.reason === "unsafe_prefix") {
      return {
        ok: true,
        install_kind: kind,
        upgradable: false,
        reason: "unsafe_prefix",
        hint: ctx.hint,
      };
    }
    return {
      ok: true,
      install_kind: "standalone",
      upgradable: false,
      reason: "unsupported_channel",
      hint: ctx.hint,
      channel: ctx.channel,
      localVersion: ctx.localVersion,
    };
  }

  const result = await applyStandaloneUpgrade({
    prefix: ctx.prefix,
    localVersion: ctx.localVersion,
    channel: ctx.channel,
    ...(ctx.localCommit ? { localCommit: ctx.localCommit } : {}),
    checkOnly: true,
    fetchOptions: { proxy },
    log: opts?.log ?? (() => {}),
    cliProgressTty: false,
  });

  switch (result.status) {
    case "would_upgrade":
      return {
        ok: true,
        install_kind: "standalone",
        upgradable: true,
        localVersion: ctx.localVersion,
        remoteVersion: result.remoteVersion,
        assetUrl: result.assetUrl,
        channel: ctx.channel,
      };
    case "up_to_date":
      return {
        ok: true,
        install_kind: "standalone",
        upgradable: false,
        reason: "up_to_date",
        localVersion: ctx.localVersion,
        channel: ctx.channel,
        ...(result.remoteVersion ? { remoteVersion: result.remoteVersion } : {}),
      };
    case "no_asset":
      return {
        ok: true,
        install_kind: "standalone",
        upgradable: false,
        reason: "no_asset",
        localVersion: ctx.localVersion,
        channel: ctx.channel,
        ...(result.remoteVersion ? { remoteVersion: result.remoteVersion } : {}),
      };
    case "no_release":
      return {
        ok: true,
        install_kind: "standalone",
        upgradable: false,
        reason: "no_release",
        localVersion: ctx.localVersion,
        channel: ctx.channel,
      };
    default:
      return {
        ok: true,
        install_kind: "standalone",
        upgradable: false,
        reason: "no_release",
        localVersion: ctx.localVersion,
        channel: ctx.channel,
      };
  }
}

/**
 * 下载并原子替换 standalone 二进制。成功后由调用方 scheduleServiceRestart。
 * 进程内替换：不在此 stop service（避免自停死锁）。
 */
export async function applyServiceUpdate(
  opts?: ServiceUpdateOpts,
): Promise<ServiceUpdateApplyResult> {
  const proxy = resolveProxy(opts?.proxy);
  const kind = getCliInstallKind();
  const ctx = resolveStandaloneContext();

  if (!ctx.ok) {
    return {
      ok: false,
      install_kind: kind,
      reason: ctx.reason,
      hint: ctx.hint,
    };
  }

  try {
    const result = await applyStandaloneUpgrade({
      prefix: ctx.prefix,
      localVersion: ctx.localVersion,
      channel: ctx.channel,
      ...(ctx.localCommit ? { localCommit: ctx.localCommit } : {}),
      checkOnly: false,
      fetchOptions: { proxy },
      log: opts?.log ?? (() => {}),
      cliProgressTty: false,
    });

    switch (result.status) {
      case "upgraded":
        return {
          ok: true,
          install_kind: "standalone",
          remoteVersion: result.remoteVersion,
          code: "service_restarting",
        };
      case "up_to_date":
        return {
          ok: false,
          install_kind: "standalone",
          reason: "up_to_date",
          ...(result.remoteVersion ? { remoteVersion: result.remoteVersion } : {}),
        };
      case "no_asset":
        return {
          ok: false,
          install_kind: "standalone",
          reason: "no_asset",
          ...(result.remoteVersion ? { remoteVersion: result.remoteVersion } : {}),
        };
      case "no_release":
        return {
          ok: false,
          install_kind: "standalone",
          reason: "no_release",
        };
      case "would_upgrade":
        return {
          ok: false,
          install_kind: "standalone",
          reason: "error",
          message: "内部错误：checkOnly 未关闭",
        };
      default: {
        const _exhaustive: never = result;
        void _exhaustive;
        return {
          ok: false,
          install_kind: "standalone",
          reason: "error",
          message: "未知升级结果",
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      install_kind: "standalone",
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
