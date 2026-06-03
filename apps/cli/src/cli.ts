#!/usr/bin/env bun
import { buildProgram } from "./program";
import { printCliError } from "./output/errors";

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    printCliError(e);
    process.exit(1);
  }
}

void main();
