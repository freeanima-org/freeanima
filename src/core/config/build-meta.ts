import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { readAppVersion } from "./version.ts";

export type {
  BuildChannel,
  BuildComponent,
  ComponentBuildMeta,
  GitBuildInfo,
  NativeShellKind,
} from "./build-meta.parse.ts";
export {
  formatBuildChannelLabel,
  formatBuildMetaLines,
  parseComponentBuildMeta,
} from "./build-meta.parse.ts";

import type {
  BuildChannel,
  BuildComponent,
  ComponentBuildMeta,
  GitBuildInfo,
  NativeShellKind,
} from "./build-meta.parse.ts";
import { parseComponentBuildMeta } from "./build-meta.parse.ts";

export type ResolveGitBuildInfoOptions = {
  repoRoot?: string;
  /** CI: GITHUB_SHA / GITHUB_REF_NAME */
  env?: NodeJS.ProcessEnv;
};

export function readBuildMetaFile(path: string): ComponentBuildMeta | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parseComponentBuildMeta(raw);
  } catch {
    return null;
  }
}

function runGit(repoRoot: string, args: string[]): string | null {
  try {
    const r = spawnSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (r.status !== 0) return null;
    const out = r.stdout?.trim();
    return out || null;
  } catch {
    return null;
  }
}

function shortSha(full: string): string {
  return full.length > 12 ? full.slice(0, 12) : full;
}

/** 本地 git 或 CI 环境变量解析 commit/branch/dirty */
export function resolveGitBuildInfo(
  opts: ResolveGitBuildInfoOptions = {},
): GitBuildInfo | undefined {
  const env = opts.env ?? process.env;
  const shaEnv = env.GITHUB_SHA?.trim() || env.CI_COMMIT_SHA?.trim();
  const branchEnv = env.GITHUB_REF_NAME?.trim() || env.CI_COMMIT_REF_NAME?.trim();

  if (shaEnv) {
    return {
      commit: shortSha(shaEnv),
      commit_full: shaEnv,
      ...(branchEnv ? { branch: branchEnv } : {}),
    };
  }

  const repoRoot = opts.repoRoot?.trim();
  if (!repoRoot || !existsSync(repoRoot)) return undefined;

  const full = runGit(repoRoot, ["rev-parse", "HEAD"]);
  if (!full) return undefined;

  const branch = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? undefined;
  const porcelain = runGit(repoRoot, ["status", "--porcelain"]);
  const isDirty = porcelain != null && porcelain.length > 0;

  return {
    commit: shortSha(full),
    commit_full: full,
    ...(branch && branch !== "HEAD" ? { branch } : {}),
    dirty: isDirty,
  };
}

export type CreateComponentBuildMetaInput = {
  component: BuildComponent;
  shell?: NativeShellKind;
  channel: BuildChannel;
  version?: string;
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
  /** prod build 产物写入 build 时间；dev 默认不写 */
  includeBuiltAt?: boolean;
  builtAt?: string;
};

export function createComponentBuildMeta(input: CreateComponentBuildMetaInput): ComponentBuildMeta {
  const version = input.version?.trim() || readAppVersion(input.repoRoot);
  const git = resolveGitBuildInfo({
    ...(input.repoRoot ? { repoRoot: input.repoRoot } : {}),
    ...(input.env ? { env: input.env } : {}),
  });
  const includeBuiltAt = input.includeBuiltAt ?? input.channel === "prod";

  return {
    component: input.component,
    ...(input.component === "native" && input.shell ? { shell: input.shell } : {}),
    version,
    channel: input.channel,
    ...(git ? { git } : {}),
    ...(includeBuiltAt ? { built_at: input.builtAt ?? new Date().toISOString() } : {}),
  };
}
