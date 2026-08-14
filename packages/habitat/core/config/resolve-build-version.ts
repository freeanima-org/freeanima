import { formatLocalVersion } from "./canary-version.ts";
import { normalizeBuildChannel, type BuildChannel } from "./build-meta.parse.ts";
import { readAppVersion } from "./version.ts";

export type ResolveBuildVersionOptions = {
  /** 显式 channel；缺省时从 env 读，未设则为 `local` */
  channel?: BuildChannel;
  now?: Date;
};

/**
 * 构建期版本：优先 `FREEANIMA_BUILD_VERSION`（CI canary/release 注入）；
 * 未设且 channel 为 `local`（本机 pack 默认）→ `{pkg}-local+UTC`；
 * 否则读根 package.json（不改写该文件）。
 */
export function resolveBuildVersionFromEnv(
  repoRoot?: string,
  env: NodeJS.ProcessEnv = process.env,
  opts?: ResolveBuildVersionOptions,
): string {
  const fromEnv = env.FREEANIMA_BUILD_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v/i, "");

  const channel = opts?.channel ?? resolveChannelForVersion(env);
  const base = readAppVersion(repoRoot);
  if (channel === "local") {
    return formatLocalVersion(base, opts?.now);
  }
  return base;
}

function resolveChannelForVersion(env: NodeJS.ProcessEnv): BuildChannel {
  const raw = env.FREEANIMA_BUILD_CHANNEL?.trim();
  if (!raw) return "local";
  return normalizeBuildChannel(raw) ?? "local";
}
