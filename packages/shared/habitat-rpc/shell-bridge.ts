/// <reference lib="dom" />

export type ShellBridge = {
  habitatUrl?: string;
  habitatWsUrl?: string;
  remoteAuth?: { token?: string };
  isNativeShell?: boolean;
  isTauri?: boolean;
};

export function readPortalShell(): ShellBridge | undefined {
  return (window as Window & { portalShell?: ShellBridge }).portalShell;
}
