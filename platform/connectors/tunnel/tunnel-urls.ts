import type { TunnelConfig } from "@freeanima/core/config";
import { WEBUI_BASE_PATH } from "@freeanima/platform/ports/constants";

export type TunnelSnapshot = {
  enabled: boolean;
  hostname: string;
  public_url: string;
  webui_url: string;
  chamber_url: string;
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
    webui_url: `${publicUrl}${WEBUI_BASE_PATH}`,
    chamber_url: `${publicUrl}${WEBUI_BASE_PATH}/chamber/dashboard`,
  };
}
