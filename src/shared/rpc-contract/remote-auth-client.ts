/// <reference lib="dom" />
/** 浏览器壳层 service API token：从 window.portalShell 解析 Habitat connect token */

type ShellRemoteAuthSource = {
  remoteAuth?: { token?: string | null } | null;
};

function readShellToken(shell: ShellRemoteAuthSource | undefined): string | undefined {
  const token = shell?.remoteAuth?.token?.trim();
  return token || undefined;
}

export function resolveShellConnectAuthToken(_habitatUrl: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as Window & {
    portalShell?: ShellRemoteAuthSource;
  };
  return readShellToken(win.portalShell);
}
