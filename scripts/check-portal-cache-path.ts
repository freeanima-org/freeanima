#!/usr/bin/env bun
/**
 * 护栏：feature UI 不得直接 readOfflineCache/writeOfflineCache。
 * 应经 withOfflineCache、模块 offline-cache 薄封装、或 portal-query。
 *
 * 允许文件名：offline-cache / offline-store / offline-xxx-adapter / pomodoro-offline-adapter
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const FEATURES = join(ROOT, "src/features");

const ALLOW_FILE =
  /(^|\/)(offline-cache|offline-store|offline-.*adapter|pomodoro-offline-adapter)\.tsx?$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p, out);
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      out.push(p);
    }
  }
  return out;
}

const offenders: string[] = [];
for (const file of walk(FEATURES)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (!rel.includes("/ui/")) continue;
  if (ALLOW_FILE.test(rel)) continue;
  const text = readFileSync(file, "utf8");
  if (/readOfflineCache|writeOfflineCache/.test(text)) {
    offenders.push(rel);
  }
}

if (offenders.length > 0) {
  console.error("portal cache path: feature UI 禁止直接 readOfflineCache/writeOfflineCache:\n");
  for (const o of offenders) console.error(`  - ${o}`);
  console.error("\n请改用 withOfflineCache，或放到 lib/offline-cache.ts 薄封装。");
  process.exit(1);
}

console.log("portal cache path: ok");
