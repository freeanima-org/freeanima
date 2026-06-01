import type { ServerType } from "@hono/node-server";
import type { NestService } from "@freeanima/core";

type NodeHttpServer = ServerType & {
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
};

/** 等待进行中的 engine 请求落盘；超时后继续关停，避免 systemd SIGKILL */
export async function waitForDrainWithTimeout(
  nest: NestService,
  maxMs: number,
): Promise<void> {
  await Promise.race([
    nest.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = nest.getInFlightCount();
        if (n > 0) {
          console.warn(`[shutdown] 请求排空超时（${maxMs}ms），仍有 ${n} 个进行中请求`);
        }
        resolve();
      }, maxMs);
    }),
  ]);
}

/**
 * 关闭 HTTP 监听。空闲 WebSocket（如 Studio 终端）会阻塞 server.close()；
 * 超时后强制断开剩余连接。
 */
export async function closeHttpServer(
  server: ServerType,
  timeoutMs = 3000,
): Promise<void> {
  const http = server as NodeHttpServer;
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const forceTimer = setTimeout(() => {
      console.log(`[shutdown] HTTP close 超时（${timeoutMs}ms），强制断开剩余连接`);
      http.closeIdleConnections?.();
      http.closeAllConnections?.();
      done();
    }, timeoutMs);
    http.closeIdleConnections?.();
    server.close(() => {
      clearTimeout(forceTimer);
      done();
    });
  });
}

export async function closeHttpServers(
  servers: ServerType[],
  timeoutMs = 3000,
): Promise<void> {
  await Promise.all(servers.map((s) => closeHttpServer(s, timeoutMs)));
}
