/// <reference lib="dom" />

export type ShellBridge = {
  habitatUrl?: string;
  habitatWsUrl?: string;
  remoteAuth?: { token?: string };
};

export function readSatelliteShell(): ShellBridge | undefined {
  return (window as Window & { satelliteShell?: ShellBridge }).satelliteShell;
}
