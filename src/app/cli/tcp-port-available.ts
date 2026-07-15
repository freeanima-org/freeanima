import { createServer } from "node:net";

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
