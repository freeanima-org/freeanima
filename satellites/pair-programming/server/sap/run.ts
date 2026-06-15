import { startSapTransport } from "./hub.ts";

/** 启动 SAP transport（幂等；transport 内 backoff 重连） */
export function connectSap(hubUrl: string, httpUrl?: string): void {
  startSapTransport(hubUrl, httpUrl);
}

if (import.meta.main) {
  const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  const port = process.env.SATELLITE_PORT ?? "4173";
  connectSap(hub, `http://127.0.0.1:${port}`);
}
