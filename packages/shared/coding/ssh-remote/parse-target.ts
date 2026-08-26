import type { SshRemoteTarget } from "./types.ts";

export type ParseSshTargetInput = {
  /** `user@host` / `user@host:port` / `ssh://user@host:port` */
  ssh: string;
  remoteWorkspace: string;
  port?: number;
  identityFile?: string;
  user?: string;
  host?: string;
};

/** 解析 SSH 目标；显式字段覆盖字符串里的同名信息 */
export function parseSshRemoteTarget(input: ParseSshTargetInput): SshRemoteTarget {
  const workspace = input.remoteWorkspace.trim();
  if (!workspace) throw new Error("remoteWorkspace 不能为空");
  if (!workspace.startsWith("/")) {
    throw new Error("remoteWorkspace 须为远端绝对路径");
  }

  let user = input.user?.trim() ?? "";
  let host = input.host?.trim() ?? "";
  let port = input.port;

  const raw = input.ssh.trim();
  if (raw) {
    let s = raw;
    if (s.toLowerCase().startsWith("ssh://")) {
      s = s.slice("ssh://".length);
    }
    // user@host:port 或 user@host 或 host
    const at = s.lastIndexOf("@");
    let hostPart = s;
    if (at >= 0) {
      user = user || s.slice(0, at);
      hostPart = s.slice(at + 1);
    }
    // IPv6 [addr]:port
    if (hostPart.startsWith("[")) {
      const end = hostPart.indexOf("]");
      if (end > 0) {
        host = host || hostPart.slice(1, end);
        const rest = hostPart.slice(end + 1);
        if (rest.startsWith(":") && port == null) {
          port = Number(rest.slice(1));
        }
      }
    } else {
      const colon = hostPart.lastIndexOf(":");
      if (colon > 0 && /^[0-9]+$/.test(hostPart.slice(colon + 1))) {
        host = host || hostPart.slice(0, colon);
        if (port == null) port = Number(hostPart.slice(colon + 1));
      } else {
        host = host || hostPart;
      }
    }
  }

  if (!user) throw new Error("缺少 SSH user");
  if (!host) throw new Error("缺少 SSH host");
  if (port != null && (!Number.isFinite(port) || port <= 0 || port > 65535)) {
    throw new Error(`非法 SSH port: ${port}`);
  }

  const identityFile = input.identityFile?.trim();
  return {
    user,
    host,
    remoteWorkspace: workspace,
    ...(port != null ? { port } : {}),
    ...(identityFile ? { identityFile } : {}),
  };
}

export function formatSshDestination(target: Pick<SshRemoteTarget, "user" | "host">): string {
  return `${target.user}@${target.host}`;
}
