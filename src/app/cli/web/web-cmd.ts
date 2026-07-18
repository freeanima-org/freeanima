import { omitUndefined } from "@freeanima/core/util";
import {
  isWebProcessAlive,
  probeWebHealth,
  resolveWebHostPort,
  startWebServer,
} from "./web-runtime.ts";
import { loadBootstrapConfig } from "@freeanima/platform/config/bootstrap.ts";
import { writeStatusLine } from "../service-common.ts";
import type { WebStaticServerHandle } from "@freeanima/app/shell/web/lib/static-server.ts";

export type WebCommandArgs = {
  action: string;
  foreground: boolean;
  host?: string;
  port?: number;
  dist?: string;
};

export async function runWebCommand(args: WebCommandArgs): Promise<void> {
  const action = args.action || "start";

  if (action === "start") {
    const alive = isWebProcessAlive();
    if (alive != null) {
      console.log(`Web UI 已在运行 (PID ${alive})`);
      process.exit(1);
    }

    if (!args.foreground) {
      console.error("Web 静态服须在前台运行，请加 --foreground");
      console.error("生产环境请配置 web.enabled: true 后使用 anima service start");
      process.exit(1);
    }

    const handle = await startWebServer(
      omitUndefined({
        host: args.host,
        port: args.port,
        dist: args.dist,
        writePid: true,
      }),
    );

    console.log(
      `Web UI · http://${handle.host === "0.0.0.0" ? "127.0.0.1" : handle.host}:${handle.port}/web/chat`,
    );
    writeStatusLine("info", "栖息地地址与 token 请在设置页配置");
    await waitForShutdown(handle);
    return;
  }

  if (action === "status") {
    await cmdWebStatus(args);
    return;
  }

  console.error(`未知操作: ${action}`);
  process.exit(1);
}

async function cmdWebStatus(args: WebCommandArgs): Promise<void> {
  const cfg = loadBootstrapConfig().web;
  const { host, port } = resolveWebHostPort(cfg);
  const bindHost = args.host ?? host;
  const bindPort = args.port ?? port;
  const pid = isWebProcessAlive();
  const up = await probeWebHealth(bindHost, bindPort);

  if (up) {
    console.log("Web UI · running");
    if (pid != null) console.log(`  pid:     ${pid}`);
    console.log(`  http:    http://${bindHost}:${bindPort}/web/chat`);
    console.log(`  console: http://${bindHost}:${bindPort}/web/console/dashboard`);
    return;
  }

  if (pid != null) {
    console.log(`Web UI · starting (PID ${pid})`);
    writeStatusLine("warning", "HTTP /health 未就绪");
    return;
  }

  console.log("Web UI · not running");
  console.log("  start: anima web start --foreground");
}

function waitForShutdown(handle: WebStaticServerHandle): Promise<void> {
  return new Promise((resolve) => {
    const onSignal = (): void => {
      void handle.close().finally(() => resolve());
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}
