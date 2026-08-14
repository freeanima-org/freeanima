#!/usr/bin/env bun
/**
 * 源码 / worktree 本机起 Habitat（前台）。不经 anima service / systemd。
 *
 *   just dev habitat
 *   just dev habitat -- --port 12001
 *   just dev habitat -- --port 12001 --strict-port
 *
 * 开发入口默认经 scripts/dev-habitat-watch.ts（debounce 硬重启）；
 * FREEANIMA_HABITAT_WATCH=0 时监督器退回单次直接跑本文件。
 * 默认随机 ≥10000 闲口（避开生产 2658/2659）。TLS 由 Vite 终止，本进程不绑 Habitat TLS。
 */
import { installErrorLogHandlers, logStartupError } from "@freeanima/habitat/platform/logging";
import { Command } from "commander";

import { resolveServiceBindHost } from "./service-bind-host.ts";
import { runServiceStack } from "./stack/supervisor.ts";
import {
  DEV_HABITAT_PORT_MIN,
  findAvailableTcpPort,
  isTcpPortInUse,
  pickRandomAvailableTcpPort,
} from "./tcp-port-available.ts";

/** 与 platform/boot/dev-web-token.ts 的 FREEANIMA_DEV_HABITAT_ENV 一致 */
const FREEANIMA_DEV_HABITAT_ENV = "FREEANIMA_DEV_HABITAT";

async function main(): Promise<void> {
  const program = new Command()
    .name("dev-habitat")
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
  just dev habitat
  just dev habitat -- --port 12001
  just dev habitat -- --port 12001 --strict-port
  FREEANIMA_HABITAT_WATCH=0 just dev habitat   # 关闭源码监视硬重启

Dev defaults: random port ≥${DEV_HABITAT_PORT_MIN} (not 2658/2659). Pair with just dev web (Vite proxy).
Production install uses standalone \`anima service\` (systemd). Source CLI has no \`service\` command.
\`just dev habitat\` 默认经 scripts/dev-habitat-watch.ts（debounce 硬重启）。
`,
    )
    .allowExcessArguments(false);

  program.parse(process.argv);
  const opts = program.opts<{ host?: string; port?: string; strictPort?: boolean }>();

  const host = resolveServiceBindHost(opts.host);
  const portArg = opts.port?.trim();
  let port: number;

  if (!portArg) {
    port = await pickRandomAvailableTcpPort(host, DEV_HABITAT_PORT_MIN);
    console.log(
      `dev-habitat · picked random port ${port} (≥${DEV_HABITAT_PORT_MIN}; not production 2658)`,
    );
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
      console.log(`dev-habitat · port ${requested} busy → using ${port}`);
    } else {
      port = requested;
    }
  }

  console.log(`dev-habitat · starting Habitat in foreground…`);
  console.log(`  address: http://${host.split(",")[0]?.trim() || host}:${port}`);
  console.log(`  http override: CLI --host/--port；Habitat TLS skipped (Vite may terminate HTTPS)`);
  console.log(`  web: Habitat 不托管 /web（UI via just dev web / WEB_DEV_PORT）`);
  console.log(`  tip: anima service is only on the standalone install CLI; TLS via Vite if needed`);

  process.env[FREEANIMA_DEV_HABITAT_ENV] = "1";
  process.env[FREEANIMA_DEV_HABITAT_ENV] = "1";
  installErrorLogHandlers();
  try {
    await runServiceStack({ host, port, skipTls: true });
  } catch (e) {
    logStartupError("dev-habitat startup failed", e);
    process.exit(1);
  }
}

await main();
