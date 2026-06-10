import type { Command } from "commander";
import { Argument } from "commander";
import { DEFAULT_BIND_HOST } from "@freeanima/service/bind-hosts";
import { runServiceCommand, type ServiceArgs } from "../service-cmd.ts";

const SERVICE_ACTIONS = ["start", "stop", "restart", "status"] as const;

export function registerServiceCommand(program: Command): void {
  program
    .command("service")
    .description("管理逸灵风服务（systemd 默认）")
    .addArgument(
      new Argument("[action]", `操作 (${SERVICE_ACTIONS.join("|")})`)
        .default("start")
        .choices([...SERVICE_ACTIONS]),
    )
    .option("--foreground", "前台运行 serve()（调试）")
    .option("--dev", "WebUI 开发模式（源码 watch 重建，刷新页面生效）")
    .option("--host <host>", "监听地址（逗号分隔可多 bind）", DEFAULT_BIND_HOST)
    .option("--port <port>", "监听端口", "2658")
    .addHelpText(
      "after",
      `
systemd（默认）:
  首次 start 会写入 ~/.config/systemd/user/anima.service
  并执行 systemctl --user enable --now anima
`,
    )
    .action(
      async (
        action: string,
        opts: { foreground?: boolean; dev?: boolean; host: string; port: string },
      ) => {
        const args: ServiceArgs = {
          action,
          foreground: Boolean(opts.foreground),
          dev: Boolean(opts.dev),
          host: opts.host,
          port: parseInt(opts.port, 10),
        };
        await runServiceCommand(args);
      },
    );
}

export { SERVICE_ACTIONS };
