import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createCliDownloadProgressSink,
  type CliDownloadProgressSink,
} from "./cli-download-progress.ts";
import { downloadReleaseAsset, type DownloadProgressHandler } from "./download.ts";
import { resolvePackagedUpdate } from "./resolve-packaged-update.ts";
import type { BuildChannel } from "../build-meta.parse.ts";
import {
  assertSafeStandaloneInstallPrefix,
  installVersionedBinary,
  migrateFlatAnimaFileIfNeeded,
  normalizeVersionFileId,
} from "../install-prefix.ts";
import { getStandaloneRuntimeMeta } from "../standalone-runtime-meta.ts";

export type ApplyStandaloneUpgradeOptions = {
  prefix: string;
  localVersion: string;
  channel: BuildChannel;
  localCommit?: string;
  intent?: "check" | "switch";
  targetChannel?: BuildChannel;
  /** 仅检查，不下载 */
  checkOnly?: boolean;
  /** 原子替换前回调（由 CLI 按需停 service） */
  beforeReplace?: () => void | Promise<void>;
  signal?: AbortSignal;
  fetchOptions?: Parameters<typeof resolvePackagedUpdate>[0]["fetchOptions"];
  log?: (msg: string) => void;
  /** 自定义下载进度；未设时 TTY stderr 自动用类 wget 单行进度条 */
  onDownloadProgress?: DownloadProgressHandler;
  createDownloadProgressSink?: (assetName: string) => CliDownloadProgressSink;
  /** 强制开/关 TTY 进度（测试用）；默认跟随 process.stderr.isTTY */
  cliProgressTty?: boolean;
};

export type ApplyStandaloneUpgradeResult =
  | { status: "up_to_date"; remoteVersion?: string }
  | { status: "no_release" }
  | { status: "no_asset"; remoteVersion?: string }
  | { status: "would_upgrade"; remoteVersion: string; assetUrl: string }
  | { status: "upgraded"; remoteVersion: string; prefix: string };

type StagedTarball = {
  stagedAnimaPath: string;
  cleanup: () => void;
};

function findAnimaInExtract(extractDir: string): string {
  const direct = join(extractDir, "anima");
  if (existsSync(direct)) return direct;
  for (const name of readdirSync(extractDir)) {
    const candidate = join(extractDir, name, "anima");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("tarball 中未找到 anima 可执行文件");
}

/** 解压 tarball 到 staging 并校验 anima 可执行文件存在 */
async function stageStandaloneTarball(tarballPath: string): Promise<StagedTarball> {
  const extractDir = mkdtempSync(join(tmpdir(), "anima-upgrade-"));
  // Prefer relative argv under extractDir so GNU tar on Windows does not treat `C:` as a host.
  const archiveName = "download.tar.gz";
  copyFileSync(resolve(tarballPath), join(extractDir, archiveName));
  const proc = Bun.spawn(["tar", "-xzf", archiveName], {
    cwd: extractDir,
    stdout: "ignore",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    rmSync(extractDir, { recursive: true, force: true });
    throw new Error(`tar 解压失败: ${err || code}`);
  }
  rmSync(join(extractDir, archiveName), { force: true });

  const stagedAnimaPath = findAnimaInExtract(extractDir);
  return {
    stagedAnimaPath,
    cleanup: () => rmSync(extractDir, { recursive: true, force: true }),
  };
}

/** 安装为 anima_<ver>，切换 current symlink，刷新 PATH，修剪旧版 */
function commitStandaloneReplace(
  stagedAnimaPath: string,
  prefix: string,
  remoteVersion: string,
  localVersion: string,
  log: (msg: string) => void,
): void {
  if (migrateFlatAnimaFileIfNeeded(prefix, localVersion)) {
    log(`已迁移旧扁平 anima → anima_${normalizeVersionFileId(localVersion)}`);
  }
  const versionId = normalizeVersionFileId(remoteVersion);
  const result = installVersionedBinary(prefix, stagedAnimaPath, versionId);
  log(`已安装版本 ${versionId}: ${result.versionPath}`);
  log(`current → ${result.currentLink}`);
  if (result.pruned.length > 0) {
    log(`已修剪旧版本: ${result.pruned.join(", ")}`);
  }
}

export async function applyStandaloneUpgrade(
  opts: ApplyStandaloneUpgradeOptions,
): Promise<ApplyStandaloneUpgradeResult> {
  const log = opts.log ?? ((msg) => console.error(msg));
  assertSafeStandaloneInstallPrefix(opts.prefix);

  const localVersion = opts.localVersion || getStandaloneRuntimeMeta()?.version || "0.0.0";
  const update = await resolvePackagedUpdate({
    kind: "standalone-linux-x64",
    localVersion,
    channel: opts.channel,
    ...(opts.localCommit ? { localCommit: opts.localCommit } : {}),
    ...(opts.intent ? { intent: opts.intent } : {}),
    ...(opts.targetChannel ? { targetChannel: opts.targetChannel } : {}),
    ...(opts.fetchOptions ? { fetchOptions: opts.fetchOptions } : {}),
  });

  if (!update.available) {
    if (update.reason === "unsupported_channel") {
      return { status: "no_release" };
    }
    if (update.reason === "up_to_date") {
      return {
        status: "up_to_date",
        ...(update.remoteVersion ? { remoteVersion: update.remoteVersion } : {}),
      };
    }
    if (update.reason === "no_asset") {
      return {
        status: "no_asset",
        ...(update.remoteVersion ? { remoteVersion: update.remoteVersion } : {}),
      };
    }
    return { status: "no_release" };
  }

  if (opts.checkOnly) {
    return {
      status: "would_upgrade",
      remoteVersion: update.remoteVersion,
      assetUrl: update.assetUrl,
    };
  }

  const tmp = mkdtempSync(join(tmpdir(), "anima-dl-"));
  const tarball = join(tmp, update.assetName);
  let staged: StagedTarball | undefined;
  const progressSink =
    opts.createDownloadProgressSink?.(update.assetName) ??
    (opts.onDownloadProgress
      ? {
          onProgress: opts.onDownloadProgress,
          finish: () => {},
        }
      : createCliDownloadProgressSink({
          fileName: update.assetName,
          isTty: opts.cliProgressTty ?? process.stderr.isTTY === true,
        }));
  try {
    log(`下载 ${update.assetUrl} …`);
    try {
      await downloadReleaseAsset(update.assetUrl, tarball, {
        ...(opts.signal ? { signal: opts.signal } : {}),
        ...(update.assetSize != null ? { expectedSize: update.assetSize } : {}),
        ...(opts.fetchOptions?.fetchImpl ? { fetchImpl: opts.fetchOptions.fetchImpl } : {}),
        onProgress: progressSink.onProgress,
      });
    } finally {
      progressSink.finish();
    }
    staged = await stageStandaloneTarball(tarball);
    await opts.beforeReplace?.();
    commitStandaloneReplace(
      staged.stagedAnimaPath,
      opts.prefix,
      update.remoteVersion,
      localVersion,
      log,
    );
  } finally {
    staged?.cleanup();
    rmSync(tmp, { recursive: true, force: true });
  }

  return { status: "upgraded", remoteVersion: update.remoteVersion, prefix: opts.prefix };
}
