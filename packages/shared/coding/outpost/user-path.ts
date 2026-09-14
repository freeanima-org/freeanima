/**
 * Coding Outpost 终端执行环境 PATH 补全。
 *
 * 宿主进程（Tauri GUI / anima-probe / CI）继承的通常是系统级 PATH，
 * 不含用户交互 shell 里的 `~/.bun/bin`、`~/.cargo/bin`、`~/.local/bin` 等，
 * 导致 `terminal_run` 中 bun / cargo / go 等用户级工具 "command not found"。
 * 本模块把常见用户 bin 目录（存在才加、去重、保持既有顺序）前置合并进 PATH，
 * 尽量还原用户在真实终端里的环境。SSH 远端无需处理：`ssh host <cmd>` 由远端登录
 * shell 执行，PATH 已含用户 bin。
 */

import { existsSync } from "node:fs";

/** 相对 $HOME 的常见用户 bin 目录（存在才加入；顺序即优先级）。 */
export const USER_BIN_REL_DIRS = [
  ".local/bin",
  ".bun/bin",
  ".cargo/bin",
  "go/bin",
  ".npm-global/bin",
  ".yarn/bin",
  "bin",
] as const;

export function pathSeparator(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? ";" : ":";
}

/** 展开 $HOME 下的候选 bin 绝对路径（Windows 用反斜杠分隔）。 */
export function userBinCandidates(
  home: string | null | undefined,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const h = home?.trim();
  if (!h) return [];
  const sep = platform === "win32" ? "\\" : "/";
  const root = h.replace(/[\\/]+$/, "");
  return USER_BIN_REL_DIRS.map((rel) => `${root}${sep}${rel.split("/").join(sep)}`);
}

export type MergeUserPathOptions = {
  /** $HOME；省略时取 process.env.HOME ?? USERPROFILE；显式传 null 表示无 home */
  home?: string | null;
  /** 存在性检查（测试注入；缺省 fs.existsSync） */
  exists?: (dir: string) => boolean;
  /** 平台（测试注入；缺省 process.platform） */
  platform?: NodeJS.Platform;
};

/**
 * 合并用户 bin 候选到 PATH 前置：候选存在且未在既有 PATH 中才加入；
 * 既有 PATH 顺序保持不变。返回新 PATH 字符串。
 */
export function mergeUserPath(
  currentPath: string | null | undefined,
  opts?: MergeUserPathOptions,
): string {
  const platform = opts?.platform ?? process.platform;
  const sep = pathSeparator(platform);
  const exists = opts?.exists ?? existsSync;
  const home =
    opts?.home === undefined ? (process.env.HOME ?? process.env.USERPROFILE ?? null) : opts.home;

  const existing = (currentPath ?? "")
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set(existing);
  const added: string[] = [];

  for (const dir of userBinCandidates(home, platform)) {
    if (seen.has(dir)) continue;
    if (exists(dir)) {
      added.push(dir);
      seen.add(dir);
    }
  }
  return [...added, ...existing].join(sep);
}
