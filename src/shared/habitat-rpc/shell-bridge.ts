/// <reference lib="dom" />

export type ShellBridge = {
  habitatUrl?: string;
  habitatWsUrl?: string;
  remoteAuth?: { token?: string };
};

export function readPortalShell(): ShellBridge | undefined {
  return (window as Window & { portalShell?: ShellBridge }).portalShell;
}
