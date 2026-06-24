#!/usr/bin/env bun
import { buildProgram, ANIMA_VERSION } from "./program.ts";
import { printCliError } from "./output/errors.ts";
import { formatCliVersion } from "@freeanima/core/config/cli-install";

async function main(): Promise<void> {
  const argv = process.argv;
  if (argv.includes("-V") || argv.includes("--version")) {
    console.log(formatCliVersion(ANIMA_VERSION));
    return;
  }

  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (e) {
    printCliError(e);
    process.exit(1);
  }
}

void main();
