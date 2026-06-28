import type { ChildProcess } from "node:child_process";
import { logStartupError } from "@freeanima/platform/logging";
import { FileConfig } from "@freeanima/platform/config";
import type { WebStaticServerHandle } from "@freeanima/app-web/static-server";

import { startWebServer } from "../web/web-runtime.ts";
import {
  migrateLegacyTunnelUnit,
  startTunnelForeground,
  stopTunnelForeground,
} from "../tunnel/tunnel-supervisor.ts";

export type ServiceStackOptions = {
  host: string;
  port: number;
};

type StackSidecars = {
  web: WebStaticServerHandle | null;
  tunnel: ChildProcess | null;
};

let sidecars: StackSidecars = { web: null, tunnel: null };
let shuttingDown = false;

async function stopStackSidecars(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  stopTunnelForeground();
  sidecars.tunnel = null;
  if (sidecars.web) {
    try {
      await sidecars.web.close();
    } catch {
      /* ignore */
    }
    sidecars.web = null;
  }
}

async function startStackSidecars(): Promise<void> {
  migrateLegacyTunnelUnit();
  const cfg = FileConfig.open().data;

  if (cfg.web?.enabled) {
    try {
      sidecars.web = await startWebServer({ writePid: false });
      console.log(`[stack] Web UI http://127.0.0.1:${sidecars.web.port}/chat`);
    } catch (err) {
      logStartupError("[stack] Web UI 启动失败", err);
    }
  }

  if (cfg.tunnel?.enabled) {
    sidecars.tunnel = startTunnelForeground();
    if (sidecars.tunnel) {
      sidecars.tunnel.on("exit", (code, signal) => {
        if (shuttingDown) return;
        console.warn(`[stack] cloudflared 退出 code=${code ?? "?"} signal=${signal ?? ""}`);
        sidecars.tunnel = null;
        if (!shuttingDown && cfg.tunnel?.enabled) {
          sidecars.tunnel = startTunnelForeground();
        }
      });
    }
  }
}

/** Hub foreground + optional Web/Tunnel 侧车（单 systemd unit） */
export async function runServiceStack(options: ServiceStackOptions): Promise<void> {
  sidecars = { web: null, tunnel: null };
  shuttingDown = false;

  const onStop = (): void => {
    void stopStackSidecars();
  };
  process.once("SIGINT", onStop);
  process.once("SIGTERM", onStop);

  const fileConfig = FileConfig.open();
  const remoteAuthToken = fileConfig.data.remote_auth?.token;

  const { serve } = await import("@freeanima/platform");
  const { startApiHttpServers, closeHttpServers, waitForDrainWithTimeout } =
    await import("@freeanima/admin-api");

  await serve(options.host, options.port, {
    foreground: true,
    http: {
      start: (hosts, port) =>
        startApiHttpServers(hosts, port, {
          remoteAuthToken,
        }),
      close: closeHttpServers,
      waitForDrain: waitForDrainWithTimeout,
    },
    onReady: () => {
      void startStackSidecars();
    },
  });

  await stopStackSidecars();
}

/** 测试用：重置侧车状态 */
export function resetStackSidecarsForTests(): void {
  sidecars = { web: null, tunnel: null };
  shuttingDown = false;
}

export function getStackWebHandle(): WebStaticServerHandle | null {
  return sidecars.web;
}
