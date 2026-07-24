#!/usr/bin/env bun
/**
 * 手写 CSS stylelint（globs 单一来源：scripts/stylelint-globs.txt）。
 * 用法：bun scripts/stylelint.ts [--fix]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const globsFile = join(import.meta.dir, "stylelint-globs.txt");
const globs = readFileSync(globsFile, "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const fix = process.argv.includes("--fix");
const args = fix ? ["--fix", ...globs] : [...globs];

const proc = Bun.spawn(["bunx", "stylelint", ...args], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
const code = await proc.exited;
process.exit(code);
