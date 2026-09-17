import { createServer } from "node:net";
import { randomInt } from "node:crypto";

/**
 * 探测 TCP 端口是否已被占用。
 * `host` 为逗号分隔绑定时，检查第一段（与 supervisor 主 listen 一致）。
 */
export function isTcpPortInUse(host: string, port: number): Promise<boolean> {
  const bindHost = host.split(",")[0]?.trim() || "0.0.0.0";
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    if (bindHost === "0.0.0.0" || bindHost === "::") {
      server.listen(port);
    } else {
      server.listen(port, bindHost);
    }
  });
}

/** 从 startPort 起顺序找闲口；找不到则抛错 */
export async function findAvailableTcpPort(
  host: string,
  startPort: number,
  maxAttempts = 50,
): Promise<number> {
  if (!Number.isFinite(startPort) || startPort < 1 || startPort > 65535) {
    throw new Error(`Invalid startPort: ${startPort}`);
  }
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (port > 65535) break;
    if (!(await isTcpPortInUse(host, port))) return port;
  }
  throw new Error(
    `No free TCP port in [${startPort}, ${Math.min(startPort + maxAttempts - 1, 65535)}] on ${host}`,
  );
}

export const DEV_HABITAT_PORT_MIN = 10_000;

/** 在 [minPort, maxPort] 内随机找闲口（dev:habitat 默认避开生产 2658/2659） */
export async function pickRandomAvailableTcpPort(
  host: string,
  minPort = DEV_HABITAT_PORT_MIN,
  maxPort = 65_535,
  attempts = 40,
): Promise<number> {
  if (minPort < 1 || maxPort > 65535 || minPort > maxPort) {
    throw new Error(`Invalid port range: [${minPort}, ${maxPort}]`);
  }
  const span = maxPort - minPort + 1;
  const tried = new Set<number>();
  for (let i = 0; i < attempts; i++) {
    let port: number;
    if (tried.size >= span) break;
    do {
      port = randomInt(minPort, maxPort + 1);
    } while (tried.has(port));
    tried.add(port);
    if (!(await isTcpPortInUse(host, port))) return port;
  }
  // 随机耗尽后顺序扫一遍
  return findAvailableTcpPort(host, minPort, Math.min(attempts, span));
}
