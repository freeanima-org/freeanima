export const TUNNEL_SYSTEMD_UNIT = "anima-tunnel";

export function tunnelServiceUnitFileName(): string {
  return `${TUNNEL_SYSTEMD_UNIT}.service`;
}

export type TunnelSystemdUnitOptions = {
  credentialsFile: string;
  configFile: string;
  tunnelId?: string;
};

export function renderTunnelSystemdUnit(execStart: string): string {
  return `[Unit]
Description=FreeAnima Cloudflare Tunnel (cloudflared)
After=network.target anima.service
Wants=anima.service

[Service]
Type=simple
ExecStart=${execStart}
Restart=always
RestartSec=15
TimeoutStopSec=30

[Install]
WantedBy=default.target
`;
}
