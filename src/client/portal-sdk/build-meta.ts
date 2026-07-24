/** 浏览器 / 壳层 UI 可安全 import 的 build-meta 类型与 JSON 解析（无 Node 依赖） */

export type BuildChannel = "release" | "canary" | "dev";

export type BuildComponent = "service" | "web" | "native";

export type NativeShellKind = "desktop" | "mobile";

export type GitBuildInfo = {
  commit: string;
  commit_full?: string;
  branch?: string;
  dirty?: boolean;
};

export type ComponentBuildMeta = {
  component: BuildComponent;
  shell?: NativeShellKind;
  version: string;
  channel: BuildChannel;
  git?: GitBuildInfo;
  built_at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** 遗留 `"prod"` 归一为 `"release"` */
export function normalizeBuildChannel(raw: unknown): BuildChannel | null {
  if (raw === "release" || raw === "canary" || raw === "dev") return raw;
  if (raw === "prod") return "release";
  return null;
}

/** 可发运轨（写 built_at、参与 GitHub 包更新） */
export function isShipChannel(channel: BuildChannel): boolean {
  return channel === "release" || channel === "canary";
}

/** 允许在 UI/CLI 在 release⇄canary 间切换 */
export function isSwitchableChannel(channel: BuildChannel): channel is "release" | "canary" {
  return channel === "release" || channel === "canary";
}

function parseGitBuildInfo(raw: unknown): GitBuildInfo | undefined {
  if (!isRecord(raw)) return undefined;
  const commit = typeof raw.commit === "string" ? raw.commit.trim() : "";
  if (!commit) return undefined;
  return {
    commit,
    ...(typeof raw.commit_full === "string" && raw.commit_full.trim()
      ? { commit_full: raw.commit_full.trim() }
      : {}),
    ...(typeof raw.branch === "string" && raw.branch.trim() ? { branch: raw.branch.trim() } : {}),
    ...(typeof raw.dirty === "boolean" ? { dirty: raw.dirty } : {}),
  };
}

/** 校验并规范化 build-meta JSON */
export function parseComponentBuildMeta(raw: unknown): ComponentBuildMeta | null {
  if (!isRecord(raw)) return null;
  const component = raw.component;
  if (component !== "service" && component !== "web" && component !== "native") return null;
  const channel = normalizeBuildChannel(raw.channel);
  if (!channel) return null;
  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  if (!version) return null;

  const shellRaw = raw.shell;
  let shell: NativeShellKind | undefined;
  if (shellRaw === "desktop" || shellRaw === "mobile") shell = shellRaw;
  if (component === "native" && !shell) return null;
  if (component !== "native" && shell !== undefined) return null;

  const git = parseGitBuildInfo(raw.git);
  const built_at =
    typeof raw.built_at === "string" && raw.built_at.trim() ? raw.built_at.trim() : undefined;

  return {
    component,
    ...(shell ? { shell } : {}),
    version,
    channel,
    ...(git ? { git } : {}),
    ...(built_at ? { built_at } : {}),
  };
}

export function formatBuildChannelLabel(channel: BuildChannel): string {
  return channel;
}

/** CLI / status 多行展示 */
export function formatBuildMetaLines(meta: ComponentBuildMeta): string[] {
  const lines: string[] = [];
  lines.push(`version ${meta.version}`);
  lines.push(`channel ${formatBuildChannelLabel(meta.channel)}`);
  if (meta.component === "native" && meta.shell) {
    lines.push(`shell ${meta.shell}`);
  }
  if (meta.git) {
    const commitLine = meta.git.commit_full
      ? `commit ${meta.git.commit} (${meta.git.commit_full})`
      : `commit ${meta.git.commit}`;
    lines.push(commitLine);
    if (meta.git.branch) lines.push(`branch ${meta.git.branch}`);
    if (meta.git.dirty === true) lines.push("dirty yes");
    else if (meta.git.dirty === false) lines.push("dirty no");
  }
  if (meta.built_at) lines.push(`built ${meta.built_at}`);
  return lines;
}
