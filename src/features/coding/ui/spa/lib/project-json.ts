/**
 * `.anima/project.json`：团队可提交的 stable_key / display_name。
 * 无文件时可由 git remote 推导 stable_key。
 */

export type ProjectJson = {
  version: number;
  stable_key: string;
  display_name?: string;
};

export type ParsedProjectJson = {
  stable_key: string;
  display_name: string | null;
  version: number;
  raw: ProjectJson;
};

/** 从 git remote URL 生成 `git:host/owner/repo`（去 .git、小写 host）。 */
export function stableKeyFromGitRemote(remoteUrl: string): string | null {
  const raw = remoteUrl.trim();
  if (!raw) return null;

  // git@github.com:org/foo.git
  const scp = raw.match(/^git@([^:]+):(.+)$/i);
  if (scp) {
    const host = scp[1]?.toLowerCase();
    const path = scp[2] != null ? normalizeRepoPath(scp[2]) : null;
    if (!host || !path) return null;
    return `git:${host}/${path}`;
  }

  // ssh://git@github.com/org/foo.git
  const ssh = raw.match(/^ssh:\/\/(?:git@)?([^/]+)\/(.+)$/i);
  if (ssh) {
    const host = ssh[1]?.toLowerCase();
    const path = ssh[2] != null ? normalizeRepoPath(ssh[2]) : null;
    if (!host || !path) return null;
    return `git:${host}/${path}`;
  }

  // https://github.com/org/foo.git
  try {
    const u = new URL(raw);
    if (!u.hostname) return null;
    const path = normalizeRepoPath(u.pathname.replace(/^\/+/, ""));
    if (!path) return null;
    return `git:${u.hostname.toLowerCase()}/${path}`;
  } catch {
    return null;
  }
}

function normalizeRepoPath(path: string): string | null {
  let p = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (p.endsWith(".git")) p = p.slice(0, -4);
  p = p.replace(/^\/+/, "");
  if (!p || p.includes("..")) return null;
  return p;
}

export function parseProjectJson(raw: string): ParsedProjectJson | null {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const stableKey = typeof obj.stable_key === "string" ? obj.stable_key.trim() : "";
  if (!stableKey) return null;
  const version = typeof obj.version === "number" && Number.isFinite(obj.version) ? obj.version : 1;
  const displayName =
    typeof obj.display_name === "string" && obj.display_name.trim()
      ? obj.display_name.trim()
      : null;
  const project: ProjectJson = {
    version,
    stable_key: stableKey,
    ...(displayName ? { display_name: displayName } : {}),
  };
  return {
    stable_key: stableKey,
    display_name: displayName,
    version,
    raw: project,
  };
}

/** 读取 workspace 下 `.anima/project.json`（经 WorkspaceSandbox backend）。 */
export async function loadProjectJsonFromWorkspace(opts: {
  readText: (absPath: string) => Promise<string>;
  workspaceRoot: string;
}): Promise<ParsedProjectJson | null> {
  const root = opts.workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const path = `${root}/.anima/project.json`;
  try {
    const text = await opts.readText(path);
    return parseProjectJson(text);
  } catch {
    return null;
  }
}
