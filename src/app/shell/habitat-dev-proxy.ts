import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Socket } from "node:net";
import { createLogger, type Logger, type Plugin, type ProxyOptions } from "vite";

const DEFAULT_PROXY_HABITAT_URL = "http://127.0.0.1:2658";

function animaHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

/** Habitat 主动断开 / 浏览器刷新时 http-proxy 常见竞态，非配置错误 */
export function isBenignWsProxyDisconnect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as NodeJS.ErrnoException & { message?: string };
  const code = e.code ?? "";
  if (code === "EPIPE" || code === "ECONNRESET" || code === "ECONNABORTED") return true;
  const msg = e.message ?? "";
  return /ended by the other party|EPIPE|ECONNRESET|write after end/i.test(msg);
}

export function isBenignWsProxyLogMessage(msg: string): boolean {
  if (!/ws proxy (socket )?error/i.test(msg)) return false;
  return /ended by the other party|EPIPE|ECONNRESET|ECONNABORTED|write after end|ECONNREFUSED/i.test(
    msg,
  );
}

/**
 * Vite `/rpc` `/mcp` proxy 目标（`/hub` 仅 legacy，0.9.3 删除）：
 * 1. `FREEANIMA_URL`
 * 2. `~/.anima/server.status.json`（dev:hub 写出的 port）
 * 3. 回退 `http://127.0.0.1:2658`
 */
export function resolveProxyHabitatUrl(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  source: "env" | "status" | "default";
} {
  const fromEnv = env.FREEANIMA_URL?.trim();
  if (fromEnv) {
    return { url: fromEnv.replace(/\/$/, ""), source: "env" };
  }

  try {
    const statusPath = join(animaHome(env), "server.status.json");
    if (existsSync(statusPath)) {
      const status = JSON.parse(readFileSync(statusPath, "utf-8")) as {
        host?: unknown;
        port?: unknown;
        phase?: unknown;
      };
      const port = typeof status.port === "number" ? status.port : Number(status.port);
      if (Number.isFinite(port) && port > 0 && port <= 65535) {
        const rawHost = typeof status.host === "string" ? status.host.trim() : "127.0.0.1";
        const host =
          rawHost === "0.0.0.0" || rawHost === "::" || rawHost === "[::]" ? "127.0.0.1" : rawHost;
        return { url: `http://${host}:${port}`, source: "status" };
      }
    }
  } catch {
    /* ignore */
  }

  return { url: DEFAULT_PROXY_HABITAT_URL, source: "default" };
}

function destroySocketQuietly(socket: unknown): void {
  if (!socket || typeof socket !== "object") return;
  const s = socket as Socket;
  if (typeof s.destroy === "function" && !s.destroyed) {
    try {
      s.destroy();
    } catch {
      /* ignore */
    }
  }
}

/** 抑制 Vite 对良性 WS 代理竞态的红色 error 刷屏（仍保留其它 proxy 错误） */
export function quietBenignWsProxyErrorsPlugin(): Plugin {
  return {
    name: "quiet-benign-ws-proxy-errors",
    config(userConfig) {
      const base: Logger = userConfig.customLogger ?? createLogger(userConfig.logLevel);
      const originalError = base.error.bind(base);
      const originalWarn = base.warn.bind(base);
      return {
        customLogger: {
          ...base,
          error(msg, options) {
            if (typeof msg === "string" && isBenignWsProxyLogMessage(msg)) {
              const kind = /socket error/i.test(msg) ? "socket" : "proxy";
              originalWarn(`[vite] hub ws ${kind} closed (benign race / peer hangup)`, options);
              return;
            }
            originalError(msg, options);
          },
        },
      };
    },
  };
}

/** Vite server.proxy 条目：Habitat RPC REST + WS */
export function createHabitatDevProxyOptions(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws: true,
    configure(proxy) {
      proxy.on("error", (err, _req, res) => {
        if (!isBenignWsProxyDisconnect(err)) return;
        destroySocketQuietly(res);
      });
      proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
        socket.on("error", (err) => {
          if (isBenignWsProxyDisconnect(err)) destroySocketQuietly(socket);
        });
      });
    },
  };
}

export function createHabitatDevProxyMap(
  target: string,
  extraPaths: readonly string[] = [],
): Record<string, ProxyOptions> {
  const opts = createHabitatDevProxyOptions(target);
  const map: Record<string, ProxyOptions> = {
    "/rpc": opts,
    "/mcp": opts,
    // @deprecated 0.9.3 删除 — 旧 /hub/rpc/v1 客户端
    "/hub": opts,
  };
  for (const path of extraPaths) {
    map[path] = opts;
  }
  return map;
}
