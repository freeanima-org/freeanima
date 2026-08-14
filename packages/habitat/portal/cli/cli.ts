#!/usr/bin/env bun
import { bootStandalone } from "./standalone-boot.ts";

await bootStandalone();

const { buildProgram, ANIMA_VERSION } = await import("./program.ts");
const { printCliError } = await import("./output/errors.ts");
const { formatCliVersion } = await import("@freeanima/habitat/core/config/cli-install");
const { resolveServiceBuildMeta } =
  await import("@freeanima/habitat/platform/service/service-build-meta");
const { isStandaloneCli } = await import("./is-standalone-cli.ts");

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
      console.error("For monorepo / worktree Habitat: just dev habitat (or just dev)");
      console.error("  e.g. just dev habitat -- --port 12001");
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
