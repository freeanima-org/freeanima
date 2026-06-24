import type { Command } from "commander";
import { runTunnelCommand } from "../tunnel-cmd.ts";

export function registerTunnelCommand(program: Command): void {
  const tunnel = program.command("tunnel").description("Cloudflare Tunnel + Access 远程访问");

  tunnel
    .command("setup")
    .description("交互式设置（含 cloudflared 安装、Tunnel、Access 配置）")
    .option("--skip-install", "跳过 cloudflared 自动安装")
    .option("--non-interactive", "非交互模式（需配合下方 flags）")
    .option("--hostname <host>", "公网 hostname")
    .option("--team <name>", "Zero Trust team 名称")
    .option("--email <addr>", "允许访问的邮箱")
    .option("--api-token <ref>", 'API Token 明文或 credential("path", "token")')
    .option("--access-api", "用 API 创建 Access App")
    .option("--session-duration <dur>", "Access session", "168h")
    .option("--port <port>", "Hub 端口（默认读 server.status.json 或 2658）")
    .option("--yes", "非交互模式跳过确认")
    .action(async (opts) => {
      await runTunnelCommand({
        action: "setup",
        skipInstall: opts.skipInstall,
        nonInteractive: opts.nonInteractive,
        hostname: opts.hostname,
        team: opts.team,
        email: opts.email,
        apiToken: opts.apiToken,
        accessApi: opts.accessApi,
        sessionDuration: opts.sessionDuration,
        port: opts.port ? Number(opts.port) : undefined,
        yes: opts.yes,
      });
    });

  tunnel
    .command("install")
    .description("仅下载/更新 cloudflared 到 ~/.anima/bin/")
    .option("--force", "强制重新下载")
    .action(async (opts) => {
      await runTunnelCommand({ action: "install", force: opts.force });
    });

  tunnel
    .command("start")
    .description("启动 cloudflared sidecar")
    .option("--foreground", "前台运行")
    .action(async (opts) => {
      await runTunnelCommand({ action: "start", foreground: opts.foreground });
    });

  tunnel
    .command("stop")
    .description("停止 cloudflared sidecar")
    .action(async () => {
      await runTunnelCommand({ action: "stop" });
    });

  tunnel
    .command("dns")
    .description("创建或校验 Tunnel 的 DNS CNAME（需 API Token 含 Zone · DNS · Edit）")
    .action(async () => {
      await runTunnelCommand({ action: "dns" });
    });

  tunnel
    .command("status")
    .description("查看 Tunnel 状态")
    .action(async () => {
      await runTunnelCommand({ action: "status" });
    });
}
