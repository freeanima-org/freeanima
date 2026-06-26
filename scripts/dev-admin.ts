#!/usr/bin/env bun
/** @deprecated 使用 Vite dev server；保留脚本以兼容旧文档链接 */
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = join(import.meta.dir, "..");
const child = spawn("bun", ["run", "dev:web"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
