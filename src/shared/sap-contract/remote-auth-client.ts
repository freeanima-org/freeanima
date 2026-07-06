/// <reference lib="dom" />
/** 浏览器壳层 service API token：从 window.satelliteShell 解析 SAP connect token */

type ShellRemoteAuthSource = {
  remoteAuth?: { token?: string | null } | null;
};

function readShellToken(shell: ShellRemoteAuthSource | undefined): string | undefined {
  const token = shell?.remoteAuth?.token?.trim();
  return token || undefined;
}

export function resolveShellConnectAuthToken(_hubUrl: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as Window & {
    satelliteShell?: ShellRemoteAuthSource;
  };
  return readShellToken(win.satelliteShell);
}
