/**
 * @deprecated Companion attach 已迁入 overlay WebView-host（spa/lib/remote-tools-host.ts）。
 * 本模块仅保留空实现，供旧 HTTP config-response / 导出兼容。
 */

export function getRemoteToolInstanceId(): string {
  return "";
}

export function isRemoteToolsConnected(): boolean {
  return false;
}

/** @deprecated use isRemoteToolsConnected */
export const isSapConnected = isRemoteToolsConnected;

export function startRemoteToolsTransport(_habitatUrl: string, _httpUrl?: string): void {
  /* no-op: overlay owns attach */
}

/** @deprecated use startRemoteToolsTransport */
export const startSapTransport = startRemoteToolsTransport;

export function reconnectRemoteTools(_habitatUrl: string, _httpUrl?: string): void {
  /* no-op: overlay listens shell:config-changed */
}

/** @deprecated use reconnectRemoteTools */
export const reconnectSap = reconnectRemoteTools;

export async function getRpcStreamClient(_habitatUrl: string, _httpUrl?: string): Promise<never> {
  throw new Error("remote tools hub runs in companion overlay, not in Node host");
}
