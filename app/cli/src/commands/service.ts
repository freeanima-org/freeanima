import type { Command } from "commander";
import { Argument } from "commander";
import { DEFAULT_BIND_HOST } from "@freeanima/platform/bind-hosts";
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
    .action(async (action: string, opts: { foreground?: boolean; host: string; port: string }) => {
      const args: ServiceArgs = {
        action,
        foreground: Boolean(opts.foreground),
        host: opts.host,
        port: parseInt(opts.port, 10),
      };
      await runServiceCommand(args);
    });
}

export { SERVICE_ACTIONS };
