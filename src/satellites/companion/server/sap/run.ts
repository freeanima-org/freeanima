import { startRemoteToolsTransport } from "./hub.ts";

/** 启动远程工具 transport（幂等；transport 内 backoff 重连） */
export function connectSap(habitatUrl: string, httpUrl?: string): void {
  startRemoteToolsTransport(habitatUrl, httpUrl);
}

/** @deprecated use connectSap / startRemoteToolsTransport */
export const runCompanionSap = connectSap;
