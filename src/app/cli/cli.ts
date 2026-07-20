#!/usr/bin/env bun
// oxlint-disable-next-line import/no-unassigned-import -- 须先于 program/ANIMA_VERSION 注册嵌入 meta
import "./standalone-embed-boot.ts";
import { buildProgram, ANIMA_VERSION } from "./program.ts";
import { printCliError } from "./output/errors.ts";
import { formatCliVersion } from "@freeanima/core/config/cli-install";
import { resolveServiceBuildMeta } from "@freeanima/platform/runtime/service-build-meta";
import { isStandaloneCli } from "./is-standalone-cli.ts";

const argv = process.argv;
if (argv.includes("-V") || argv.includes("--version")) {
  const build = resolveServiceBuildMeta();
  console.log(`${formatCliVersion(ANIMA_VERSION)} · ${build.channel}`);
} else {
  // 源码 CLI 不注册 service；友好提示（避免仅 unknown command）
  if (!isStandaloneCli()) {
    const args = argv.slice(2).filter((a) => a !== "--");
    if (args[0] === "service") {
      console.error("`anima service` is only available in the standalone install CLI.");
      console.error("For monorepo / worktree Habitat: bun run dev:hub (or just dev)");
      console.error("  e.g. bun run dev:hub -- --port 12001");
      process.exit(1);
    }
  }

  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (e) {
    printCliError(e);
    process.exit(1);
  }
}
