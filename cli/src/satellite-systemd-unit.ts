import { SYSTEMD_UNIT as HUB_SYSTEMD_UNIT } from "./systemd-unit.ts";
import type { SatelliteLaunch } from "./satellite-launch.ts";

export const SATELLITE_UNIT_PREFIX = "anima-satellite-";

export function satelliteSystemdUnitName(configKey: string): string {
  return `${SATELLITE_UNIT_PREFIX}${configKey}`;
}

export function satelliteServiceUnitFileName(configKey: string): string {
  return `${satelliteSystemdUnitName(configKey)}.service`;
}

/** Generate systemd user unit for a managed satellite. */
export function renderSatelliteSystemdUnit(configKey: string, launch: SatelliteLaunch): string {
  const mergedEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    ...launch.environment,
  };
  const envLines = Object.entries(mergedEnv)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `Environment=${key}=${value}`)
    .join("\n");

  return `[Unit]
Description=Free Anima satellite: ${configKey}
After=network.target ${HUB_SYSTEMD_UNIT}.service
PartOf=${HUB_SYSTEMD_UNIT}.service

[Service]
Type=simple
WorkingDirectory=${launch.workingDirectory}
${envLines}
ExecStart=${launch.execStart}
Restart=always
RestartSec=30
TimeoutStopSec=60

[Install]
WantedBy=default.target
`;
}
