import { startSapTransport } from "./hub.ts";

/** 启动 SAP transport（幂等；transport 内 backoff 重连） */
export function connectSap(hubUrl: string, httpUrl?: string): void {
  startSapTransport(hubUrl, httpUrl);
}
