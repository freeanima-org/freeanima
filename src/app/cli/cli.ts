#!/usr/bin/env bun
import { bootStandaloneEmbeds } from "./standalone-embed-boot.ts";
import { buildProgram, ANIMA_VERSION } from "./program.ts";
import { printCliError } from "./output/errors.ts";
import { formatCliVersion } from "@freeanima/core/config/cli-install";
import { resolveServiceBuildMeta } from "@freeanima/platform/runtime/service-build-meta";

bootStandaloneEmbeds();

const argv = process.argv;
if (argv.includes("-V") || argv.includes("--version")) {
  const build = resolveServiceBuildMeta();
  console.log(`${formatCliVersion(ANIMA_VERSION)} · ${build.channel}`);
} else {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (e) {
    printCliError(e);
    process.exit(1);
  }
}
