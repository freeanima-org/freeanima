import type { TunnelConfig } from "@freeanima/core/config";

export type TunnelSnapshot = {
  enabled: boolean;
  hostname: string;
  public_url: string;
  api_url: string;
  web_url: string | null;
};

/** 从 tunnel 配置生成公网 URL（不含运行状态） */
export function buildTunnelSnapshot(tunnel: TunnelConfig | undefined): TunnelSnapshot | undefined {
  if (!tunnel?.enabled || !tunnel.hostname?.trim()) return undefined;
  const hostname = tunnel.hostname.trim();
  const publicUrl = `https://${hostname}`;
  return {
    enabled: true,
    hostname,
    public_url: publicUrl,
    api_url: `${publicUrl}/api`,
    web_url: `${publicUrl}/web`,
  };
}
