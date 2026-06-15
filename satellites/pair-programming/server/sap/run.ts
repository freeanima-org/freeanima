import { getSapClient } from "./hub.ts";

/** 启动 SAP 连接（幂等；HTTP handler 也会 lazy connect） */
export async function connectSap(hubUrl: string): Promise<void> {
  await getSapClient(hubUrl);
}

if (import.meta.main) {
  const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  void connectSap(hub).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
