import type { ChildProcess } from "node:child_process";
import { logStartupError } from "@freeanima/platform/logging";
import { FileConfig } from "@freeanima/platform/config";
import { systemdUserAvailable } from "../systemd-unit.ts";

import { ensureWebDistBuilt } from "../web/ensure-dist.ts";
import { resolveWebDistDir } from "../web/dist-path.ts";
import {
  findCloudflaredPidOnHost,
  startTunnelForStack,
  stopTunnelForeground,
} from "../tunnel/tunnel-supervisor.ts";

export type ServiceStackOptions = {
  host: string;
  port: number;
};

type StackSidecars = {
  tunnel: ChildProcess | null;
};

let sidecars: StackSidecars = { tunnel: null };
let shuttingDown = false;

async function stopStackSidecars(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  // 仅停前台 spawn；systemd tunnel 由 `anima service stop` / stopHubStackViaSystemd 统一关停。
  // 避免 restart 时旧进程 SIGTERM 误杀新 stack 刚拉起的 anima-tunnel.service。
  stopTunnelForeground();
  sidecars.tunnel = null;
}

async function startStackSidecars(hubPort: number): Promise<void> {
  const cfg = FileConfig.open().data;

  if (cfg.web?.enabled) {
    console.log(`[stack] Web UI http://127.0.0.1:${hubPort}/web/chat（由 Hub 托管）`);
  }

  if (cfg.tunnel?.enabled) {
    sidecars.tunnel = startTunnelForStack();
    if (sidecars.tunnel) {
      sidecars.tunnel.on("exit", (code, signal) => {
        if (shuttingDown) return;
        console.warn(`[stack] cloudflared 退出 code=${code ?? "?"} signal=${signal ?? ""}`);
        sidecars.tunnel = null;
        if (!shuttingDown && cfg.tunnel?.enabled) {
          sidecars.tunnel = startTunnelForStack();
        }
      });
    } else if (findCloudflaredPidOnHost() == null && !systemdUserAvailable()) {
      console.warn("[stack] cloudflared 侧车未启动（见上方日志或 error.log）");
    }
  }
}

/** Hub foreground + optional Tunnel 侧车（Web 静态由 Hub /web 托管） */
export async function runServiceStack(options: ServiceStackOptions): Promise<void> {
  sidecars = { tunnel: null };
  shuttingDown = false;

  const onStop = (): void => {
    void stopStackSidecars();
  };
  process.once("SIGINT", onStop);
  process.once("SIGTERM", onStop);

  const fileConfig = FileConfig.open();
  const cfg = fileConfig.data;
  const remoteAuthToken = cfg.remote_auth?.token;

  let webStatic: { distDir: string; appId?: string } | null = null;
  if (cfg.web?.enabled) {
    try {
      await ensureWebDistBuilt();
      webStatic = { distDir: resolveWebDistDir(), appId: "chat" };
    } catch (err) {
      logStartupError("[stack] Web dist 准备失败", err);
    }
  }

  const { serve } = await import("@freeanima/platform");
  const { startApiHttpServers, closeHttpServers, waitForDrainWithTimeout } =
    await import("@freeanima/admin-api");

  await serve(options.host, options.port, {
    foreground: true,
    http: {
      start: (hosts, port) =>
        startApiHttpServers(hosts, port, {
          remoteAuthToken,
          webStatic,
        }),
      close: closeHttpServers,
      waitForDrain: waitForDrainWithTimeout,
    },
    onReady: () => {
      void startStackSidecars(options.port);
    },
  });

  await stopStackSidecars();
}

/** 测试用：重置侧车状态 */
export function resetStackSidecarsForTests(): void {
  sidecars = { tunnel: null };
  shuttingDown = false;
}
