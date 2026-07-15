#!/usr/bin/env bun
/**
 * 源码 / worktree 本机起 Hub（前台）。不经 anima service / systemd。
 *
 *   bun run dev:hub
 *   bun run dev:hub -- --port 2701
 */
import { installErrorLogHandlers, logStartupError } from "@freeanima/platform/logging";
import { Command } from "commander";

import { resolveServiceBindHost } from "./service-bind-host.ts";
import { runServiceStack } from "./stack/supervisor.ts";
import { isTcpPortInUse } from "./tcp-port-available.ts";

const DEFAULT_PORT = 2658;

async function main(): Promise<void> {
  const program = new Command()
    .name("dev-hub")
    .description("Run FreeAnima Hub in foreground (monorepo / worktree; not anima service)")
    .option(
      "--host <host>",
      "Listen address (overrides http.host in config; comma-separated for multiple binds)",
    )
    .option("--port <port>", "Listen port", String(DEFAULT_PORT))
    .addHelpText(
      "after",
      `
Examples:
  bun run dev:hub
  bun run dev:hub -- --port 2701

Production install uses standalone \`anima service\` (systemd). Source CLI has no \`service\` command.
`,
    )
    .allowExcessArguments(false);

  program.parse(process.argv);
  const opts = program.opts<{ host?: string; port: string }>();

  const host = resolveServiceBindHost(opts.host);
  const port = parseInt(opts.port, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    console.error(`Invalid --port: ${opts.port}`);
    process.exit(1);
  }

  if (await isTcpPortInUse(host, port)) {
    console.error(`Port ${port} is already in use (bind ${host}).`);
    console.error(`Try another port, e.g. bun run dev:hub -- --port ${port + 1}`);
    process.exit(1);
  }

  console.log(`dev-hub · starting Hub in foreground…`);
  console.log(`  address: http://${host.split(",")[0]?.trim() || host}:${port}`);
  console.log(`  tip: anima service is only on the standalone install CLI`);

  installErrorLogHandlers();
  try {
    await runServiceStack({ host, port });
  } catch (e) {
    logStartupError("dev-hub startup failed", e);
    process.exit(1);
  }
}

await main();
