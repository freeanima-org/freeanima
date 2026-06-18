import { SATELLITE_PORT_MAX, SATELLITE_PORT_START } from "@shared/constants.ts";
import { getSidecarPort, isTauri, listenSidecarReady } from "./tauri.ts";

async function probeSidecarHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Tauri 生产包：API 必须走 sidecar HTTP，不能走内嵌 asset 路径 */
export async function resolveSidecarOrigin(maxWaitMs = 45_000): Promise<string> {
  if (!isTauri()) {
    return window.location.origin;
  }

  let eventPort: number | null = null;
  const offReady = await listenSidecarReady((port) => {
    eventPort = port;
  });

  const deadline = Date.now() + maxWaitMs;
  try {
    while (Date.now() < deadline) {
      const ports: number[] = [];
      if (eventPort != null) ports.push(eventPort);
      const reported = await getSidecarPort();
      if (reported) ports.push(reported);
      for (let port = SATELLITE_PORT_START; port <= SATELLITE_PORT_MAX; port++) {
        ports.push(port);
      }

      const seen = new Set<number>();
      for (const port of ports) {
        if (seen.has(port)) continue;
        seen.add(port);
        if (await probeSidecarHealth(port)) {
          return `http://127.0.0.1:${port}`;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    offReady();
  }

  throw new Error(
    "伴侣后台服务启动超时。请查看 %USERPROFILE%\\.anima\\companion\\shell.log，" +
      `将安装目录中的 companion-bun.exe 加入杀毒软件白名单，并确认 ${SATELLITE_PORT_START}–${SATELLITE_PORT_MAX} 端口未被占用。`,
  );
}
