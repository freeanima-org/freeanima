#!/usr/bin/env bun
/**
 * standalone 冒烟：离开构建机 tiktoken 路径后仍能启动。
 *
 * 用法（在 just pack cli 之后）：
 *   bun scripts/smoke-standalone-tiktoken.ts
 */
import { renameSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  assertStandaloneBinaryHasNoTiktokenBuildPath,
  resolveTiktokenWasmPath,
} from "./tiktoken-wasm-plugin.ts";

const ROOT = join(import.meta.dir, "..");
const BIN = join(ROOT, "dist/anima-executable/anima");

function run(bin: string, args: string[]): void {
  const r = spawnSync(bin, args, { encoding: "utf-8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) {
    throw new Error(`smoke failed: ${bin} ${args.join(" ")}\n${out}`);
  }
  if (out.includes("Missing tiktoken_bg.wasm")) {
    throw new Error(`smoke hit Missing tiktoken_bg.wasm:\n${out}`);
  }
  console.log(`ok: ${bin} ${args.join(" ") || "(no args)"}`);
  if (args.includes("--version") || args.length === 0) {
    console.log(out.trim().split("\n").slice(0, 3).join("\n"));
  }
}

function main(): void {
  if (!existsSync(BIN)) {
    throw new Error(`missing ${BIN}; run just pack cli first`);
  }

  const wasmPath = resolveTiktokenWasmPath(ROOT);
  const tiktokenDir = dirname(wasmPath);
  assertStandaloneBinaryHasNoTiktokenBuildPath(BIN, tiktokenDir);

  const hidden = `${tiktokenDir}.smoke-hidden`;
  if (existsSync(hidden)) {
    throw new Error(`refusing to overwrite ${hidden}; remove it and retry`);
  }

  console.log(`hiding build-machine tiktoken dir: ${tiktokenDir}`);
  renameSync(tiktokenDir, hidden);
  try {
    if (existsSync(tiktokenDir)) {
      throw new Error("tiktoken dir still visible after rename");
    }
    run(BIN, ["--version"]);
    run(BIN, ["--help"]);
  } finally {
    renameSync(hidden, tiktokenDir);
    console.log(`restored ${tiktokenDir}`);
  }

  console.log("smoke-standalone-tiktoken: passed");
}

main();
