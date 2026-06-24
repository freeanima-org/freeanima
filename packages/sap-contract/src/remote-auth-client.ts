/** 浏览器壳层 remote_auth：从 window.satelliteShell 解析 SAP connect token */

type ShellRemoteAuthSource = {
  remoteAuth?: { token?: string | null } | null;
};

function readShellToken(shell: ShellRemoteAuthSource | undefined): string | undefined {
  const token = shell?.remoteAuth?.token?.trim();
  return token || undefined;
}

export function resolveShellConnectAuthToken(hubUrl: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as Window & {
    satelliteShell?: ShellRemoteAuthSource;
    companionShell?: ShellRemoteAuthSource;
  };
  const token = readShellToken(win.satelliteShell) ?? readShellToken(win.companionShell);
  if (!token) return undefined;
  try {
    const withScheme = /^https?:\/\//i.test(hubUrl) ? hubUrl : `http://${hubUrl}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") return undefined;
  } catch {
    return undefined;
  }
  return token;
}
