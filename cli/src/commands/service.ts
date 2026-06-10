import type { Command } from "commander";
import { Argument } from "commander";
import { DEFAULT_BIND_HOST } from "@freeanima/service/bind-hosts";
import { runServiceCommand, type ServiceArgs } from "../service-cmd.ts";

const SERVICE_ACTIONS = ["start", "stop", "restart", "status"] as const;

export function registerServiceCommand(program: Command): void {
  program
    .command("service")
    .description("Manage Free Anima service (systemd default)")
    .addArgument(
      new Argument("[action]", `action (${SERVICE_ACTIONS.join("|")})`)
        .default("start")
        .choices([...SERVICE_ACTIONS]),
    )
    .option("--foreground", "Run serve() in foreground (debug)")
    .option("--dev", "WebUI dev mode (source watch rebuild, refresh page to apply)")
    .option(
      "--host <host>",
      "Listen address (comma-separated for multiple binds)",
      DEFAULT_BIND_HOST,
    )
    .option("--port <port>", "Listen port", "2658")
    .addHelpText(
      "after",
      `
systemd (default):
  First start writes ~/.config/systemd/user/anima.service
  and runs systemctl --user enable --now anima
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
