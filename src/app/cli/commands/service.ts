import type { Command } from "commander";
import { Argument } from "commander";
import { runServiceCommand, type ServiceArgs } from "../service-cmd.ts";
import { resolveServiceBindHost } from "../service-bind-host.ts";

const SERVICE_ACTIONS = ["start", "stop", "restart", "status"] as const;

export function registerServiceCommand(program: Command): void {
  program
    .command("service")
    .description("Manage Free Anima service (standalone install only; systemd default)")
    .addArgument(
      new Argument("[action]", `action (${SERVICE_ACTIONS.join("|")})`)
        .default("start")
        .choices([...SERVICE_ACTIONS]),
    )
    .option("--foreground", "Run serve() in foreground (used by systemd unit)")
    .option(
      "--host <host>",
      "Listen address (overrides http.host in config; comma-separated for multiple binds)",
    )
    .option("--port <port>", "Listen port", "2658")
    .addHelpText(
      "after",
      `
standalone install only (not available in source-tree anima CLI).

Monorepo / worktree Habitat: just dev habitat

systemd (default):
  First start writes ~/.config/systemd/user/anima.service
  and runs systemctl --user enable --now anima
`,
    )
    .action(async (action: string, opts: { foreground?: boolean; host?: string; port: string }) => {
      const args: ServiceArgs = {
        action,
        foreground: Boolean(opts.foreground),
        host: resolveServiceBindHost(opts.host),
        port: parseInt(opts.port, 10),
      };
      await runServiceCommand(args);
    });
}

export { SERVICE_ACTIONS };
