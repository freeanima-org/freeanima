#!/usr/bin/env bun
/**
 * 源码 / worktree 本机起 Habitat（前台）。不经 anima service / systemd。
 *
 *   bun run dev:hub
 *   bun run dev:hub -- --port 12001
 *   bun run dev:hub -- --port 12001 --strict-port
 *
 * 默认随机 ≥10000 闲口（避开生产 2658/2659）。TLS 由 Vite 终止，本进程不绑 Habitat TLS。
 */
import { installErrorLogHandlers, logStartupError } from "@freeanima/platform/logging";
import { Command } from "commander";

import { resolveServiceBindHost } from "./service-bind-host.ts";
import { runServiceStack } from "./stack/supervisor.ts";
import {
  DEV_HUB_PORT_MIN,
  findAvailableTcpPort,
  isTcpPortInUse,
  pickRandomAvailableTcpPort,
} from "./tcp-port-available.ts";

/** 与 platform/boot/dev-web-token.ts 的 FREEANIMA_DEV_HUB_ENV 一致 */
const FREEANIMA_DEV_HUB_ENV = "FREEANIMA_DEV_HUB";
async function main(): Promise<void> {
  const program = new Command()
    .name("dev-hub")
    .description("Run FreeAnima Habitat in foreground (monorepo / worktree; not anima service)")
    .option(
      "--host <host>",
      "Listen address (overrides http.host in config; comma-separated for multiple binds)",
    )
    .option(
      "--port <port>",
      "Listen port (omit for random ≥10000; production anima service still uses 2658)",
    )
    .option(
      "--strict-port",
      "Fail if --port is occupied (default: pick next free port when --port is set)",
    )
    .addHelpText(
      "after",
      `
Examples:
  bun run dev:hub
  bun run dev:hub -- --port 12001
  bun run dev:hub -- --port 12001 --strict-port

Dev defaults: random port ≥${DEV_HUB_PORT_MIN} (not 2658/2659). Pair with bun run dev:web (Vite proxy).
Production install uses standalone \`anima service\` (systemd). Source CLI has no \`service\` command.
`,
    )
    .allowExcessArguments(false);

  program.parse(process.argv);
  const opts = program.opts<{ host?: string; port?: string; strictPort?: boolean }>();

  const host = resolveServiceBindHost(opts.host);
  const portArg = opts.port?.trim();
  let port: number;

  if (!portArg) {
    port = await pickRandomAvailableTcpPort(host, DEV_HUB_PORT_MIN);
    console.log(`dev-hub · picked random port ${port} (≥${DEV_HUB_PORT_MIN}; not production 2658)`);
  } else {
    const requested = parseInt(portArg, 10);
    if (!Number.isFinite(requested) || requested <= 0 || requested > 65535) {
      console.error(`Invalid --port: ${opts.port}`);
      process.exit(1);
    }
    if (await isTcpPortInUse(host, requested)) {
      if (opts.strictPort) {
        console.error(`Port ${requested} is already in use (bind ${host}).`);
        console.error(`Omit --strict-port to auto-pick the next free port.`);
        process.exit(1);
      }
      port = await findAvailableTcpPort(host, requested);
      console.log(`dev-hub · port ${requested} busy → using ${port}`);
    } else {
      port = requested;
    }
  }

  console.log(`dev-hub · starting Habitat in foreground…`);
  console.log(`  address: http://${host.split(",")[0]?.trim() || host}:${port}`);
  console.log(`  http override: CLI --host/--port；Habitat TLS skipped (Vite may terminate HTTPS)`);
  console.log(
    `  web override: Habitat ignores config.yaml web.* (UI via bun run dev:web / WEB_DEV_PORT)`,
  );
  console.log(`  tip: anima service is only on the standalone install CLI; TLS via Vite if needed`);

  process.env[FREEANIMA_DEV_HUB_ENV] = "1";
  installErrorLogHandlers();
  try {
    await runServiceStack({ host, port, skipTls: true });
  } catch (e) {
    logStartupError("dev-hub startup failed", e);
    process.exit(1);
  }
}

await main();
