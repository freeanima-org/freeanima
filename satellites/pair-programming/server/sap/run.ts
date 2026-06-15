import { getSapClient } from "./hub.ts";

/** 启动 SAP 连接（幂等；HTTP handler 也会 lazy connect） */
export async function connectSap(hubUrl: string, httpUrl?: string): Promise<void> {
  await getSapClient(hubUrl, httpUrl);
}

if (import.meta.main) {
  const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  const port = process.env.SATELLITE_PORT ?? "4173";
  void connectSap(hub, `http://127.0.0.1:${port}`).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
