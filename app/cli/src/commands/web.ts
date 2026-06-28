import type { Command } from "commander";
import { Argument } from "commander";
import { DEFAULT_WEB_HOST, DEFAULT_WEB_PORT } from "@freeanima/core/config";

import { runWebCommand, type WebCommandArgs } from "../web/web-cmd.ts";

const WEB_ACTIONS = ["start", "status"] as const;

export function registerWebCommand(program: Command): void {
  program
    .command("web")
    .description("Manage browser Web UI static server")
    .addArgument(
      new Argument("[action]", `action (${WEB_ACTIONS.join("|")})`)
        .default("start")
        .choices([...WEB_ACTIONS]),
    )
    .option("--foreground", "Run static server in foreground")
    .option("--host <host>", "Listen address", DEFAULT_WEB_HOST)
    .option("--port <port>", "Listen port", String(DEFAULT_WEB_PORT))
    .option("--dist <dir>", "Override static dist directory")
    .option("--skip-build", "Skip monorepo auto-build before start")
    .addHelpText(
      "after",
      `
生产环境推荐 \`web.enabled: true\` 后随 \`anima service start\` 一并启动。
npm 发布包内置 dist；monorepo 下 start 会自动检测并在需要时 build（\`--skip-build\` 或 FREEANIMA_WEB_SKIP_BUILD=1 可跳过）。
`,
    )
    .action(
      async (
        action: string,
        opts: {
          foreground?: boolean;
          host: string;
          port: string;
          dist?: string;
          skipBuild?: boolean;
        },
      ) => {
        const args: WebCommandArgs = {
          action,
          foreground: Boolean(opts.foreground),
          host: opts.host,
          port: parseInt(opts.port, 10),
          dist: opts.dist,
          skipBuild: Boolean(opts.skipBuild),
        };
        await runWebCommand(args);
      },
    );
}

export { WEB_ACTIONS };
