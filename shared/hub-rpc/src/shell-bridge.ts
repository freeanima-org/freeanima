/// <reference lib="dom" />

export type ShellBridge = {
  hubUrl?: string;
  hubWsUrl?: string;
  remoteAuth?: { token?: string };
};

export function readSatelliteShell(): ShellBridge | undefined {
  return (window as Window & { satelliteShell?: ShellBridge }).satelliteShell;
}
