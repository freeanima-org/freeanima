#!/usr/bin/env bun
/**
 * 打包 anima-client / anima-probe（Linux x64 standalone，供 SSH scp / PATH）。
 *
 * 产物：
 *   dist/outpost-clis/anima-client
 *   dist/outpost-clis/anima-probe
 *
 * 用法：
 *   just pack client-probe
 *   bun scripts/build-outpost-clis.ts
 */
import { $ } from "bun";
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "dist/outpost-clis");
const CLIENT_ENTRY = join(ROOT, "packages/habitat/portal/client/cli.ts");
const PROBE_ENTRY = join(ROOT, "packages/habitat/portal/probe/cli.ts");

async function compileOne(entrypoint: string, outfile: string, label: string): Promise<void> {
  console.log(`[pack client-probe] compiling ${label} → ${outfile}`);
  const result = await Bun.build({
    entrypoints: [entrypoint],
    compile: {
      outfile,
      autoloadBunfig: false,
    },
  });
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error(`Bun.build --compile failed for ${label}`);
  }
  chmodSync(outfile, 0o755);
}

async function main(): Promise<void> {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const clientOut = join(OUT_DIR, "anima-client");
  const probeOut = join(OUT_DIR, "anima-probe");
  await compileOne(CLIENT_ENTRY, clientOut, "anima-client");
  await compileOne(PROBE_ENTRY, probeOut, "anima-probe");

  const clientVer = await $`${clientOut} --help`.nothrow().quiet();
  if (clientVer.exitCode !== 0 && clientVer.exitCode !== 1) {
    // commander --help usually exits 0; tolerate other success-ish
    console.warn(`[pack client-probe] anima-client --help exit=${clientVer.exitCode}`);
  }
  const probeHelp = await $`${probeOut} --help`.nothrow().quiet();
  if (probeHelp.exitCode !== 0 && probeHelp.exitCode !== 1) {
    console.warn(`[pack client-probe] anima-probe --help exit=${probeHelp.exitCode}`);
  }

  console.log(`[pack client-probe] ready: ${clientOut}`);
  console.log(`[pack client-probe] ready: ${probeOut}`);

  // 默认装到 ~/.anima/bin，供 SSH ensure-probe scp
  const binDir = join(homedir(), ".anima", "bin");
  mkdirSync(binDir, { recursive: true });
  const probeInstall = join(binDir, "anima-probe");
  const clientInstall = join(binDir, "anima-client");
  cpSync(probeOut, probeInstall);
  cpSync(clientOut, clientInstall);
  chmodSync(probeInstall, 0o755);
  chmodSync(clientInstall, 0o755);
  console.log(`[pack client-probe] installed → ${probeInstall}`);
  console.log(`[pack client-probe] installed → ${clientInstall}`);

  if (!existsSync(probeInstall)) {
    throw new Error("install anima-probe failed");
  }
}

await main();
