import { installCloudflared, manualDownloadHint } from "./tunnel-install.ts";
import { runTunnelSetup, type SetupPromptsOptions } from "./tunnel-setup-prompts.ts";
import {
  formatTunnelConnectedLabel,
  getTunnelStatus,
  startTunnelForeground,
  startTunnelViaSystemd,
  stopTunnelForeground,
  stopTunnelViaSystemd,
} from "./tunnel-supervisor.ts";
import { writeStatusLine } from "../service-common.ts";
import { systemdUserAvailable } from "../systemd-unit.ts";
import { runTunnelDnsEnsure } from "./tunnel-dns-cmd.ts";

export type TunnelCommandArgs = {
  action: string;
  skipInstall?: boolean;
  nonInteractive?: boolean;
  hostname?: string;
  apiToken?: string;
  port?: number;
  yes?: boolean;
  force?: boolean;
  foreground?: boolean;
};

export async function runTunnelCommand(args: TunnelCommandArgs): Promise<void> {
  const action = args.action || "status";

  if (action === "install") {
    try {
      await installCloudflared({
        force: args.force,
        onProgress: (msg) => console.log(msg),
      });
      writeStatusLine("ok", "cloudflared 已安装");
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      console.error(`手动下载: ${manualDownloadHint()}`);
      process.exit(1);
    }
    return;
  }

  if (action === "setup") {
    const opts: SetupPromptsOptions = {
      skipInstall: args.skipInstall,
      nonInteractive: args.nonInteractive,
      hostname: args.hostname,
      apiToken: args.apiToken,
      port: args.port,
      yes: args.yes,
    };
    await runTunnelSetup(opts);
    return;
  }

  if (action === "start") {
    const status = getTunnelStatus();
    if (!status.enabled) {
      console.error("tunnel.enabled 未开启 — 先运行 anima tunnel setup");
      process.exit(1);
    }
    if (args.foreground || !systemdUserAvailable()) {
      const child = startTunnelForeground();
      if (!child) {
        console.error("无法启动 cloudflared — 检查 install 与 config");
        process.exit(1);
      }
      console.log("cloudflared 前台运行中 (Ctrl+C 停止)");
      await new Promise<void>((resolve) => {
        child.on("exit", () => resolve());
      });
      return;
    }
    startTunnelViaSystemd();
    writeStatusLine("ok", "Tunnel 已通过 systemd 启动");
    return;
  }

  if (action === "stop") {
    stopTunnelForeground();
    stopTunnelViaSystemd();
    writeStatusLine("ok", "Tunnel 已停止");
    return;
  }

  if (action === "dns") {
    await runTunnelDnsEnsure();
    return;
  }

  if (action === "status") {
    const s = getTunnelStatus();
    console.log("Cloudflare Tunnel 状态");
    console.log(`  enabled:           ${s.enabled}`);
    console.log(`  running:           ${s.running}`);
    console.log(
      `  connected:         ${formatTunnelConnectedLabel({ connected: s.connected, haConnections: s.haConnections })}`,
    );
    console.log(`  public URL:        ${s.publicUrl ?? "(未配置)"}`);
    console.log(`  cloudflared:       ${s.cloudflaredInstalled ? "已安装" : "未安装"}`);
    console.log(`  config:            ${s.configExists ? "存在" : "缺失"}`);
    return;
  }

  console.error(`未知操作: ${action}`);
  process.exit(1);
}

export function startTunnelSidecar(opts: { foreground: boolean }): void {
  const status = getTunnelStatus();
  if (!status.enabled || !status.configExists) return;
  if (opts.foreground) {
    startTunnelForeground();
  }
}

export function stopTunnelSidecar(): void {
  stopTunnelForeground();
  stopTunnelViaSystemd();
}
