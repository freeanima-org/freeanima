#!/usr/bin/env bun
import { buildProgram } from "./program.js";
import { printCliError } from "./output/errors.js";

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
