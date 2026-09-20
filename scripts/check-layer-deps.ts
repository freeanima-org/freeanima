#!/usr/bin/env bun
/**
 * 全仓层依赖扫描（含相对路径 / 测试文件）+ 存量基线棘轮。
 *
 * 目标 DAG 与判定 SSOT：`scripts/oxlint-plugins/freeanima/lib/layer-deps.ts`
 * （oxlint 规则 `freeanima/layer-deps` 共用该实现与同一份基线）。
 *
 * 基线单位是「层对 × 文件」：清单内的文件允许存在该层对违规；出现未列出的
 * 文件即失败。每阶段修完一批后跑 `--update` 收紧基线。
 *
 * 用法：
 *   bun scripts/check-layer-deps.ts            # 校验
 *   bun scripts/check-layer-deps.ts --update   # 收紧基线
 *   bun scripts/check-layer-deps.ts --print    # 只打印现状
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  checkLayerEdge,
  layerOfPath,
  targetLayer,
} from "./oxlint-plugins/freeanima/lib/layer-deps.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const BASELINE_TS = join(REPO_ROOT, "scripts/oxlint-plugins/freeanima/lib/layer-deps-baseline.ts");
const UPDATE = process.argv.includes("--update");
const PRINT = process.argv.includes("--print");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-types",
  "dist-desktop",
  "dist-mobile",
  "dist-float",
  "target",
  ".git",
  ".wxt",
  "src-tauri",
]);

type Baseline = Record<string, string[]>;

const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*)(["'])([^"'\n]+)\2/g;

function collectFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
}

function readBaseline(): Baseline {
  try {
    const text = readFileSync(BASELINE_TS, "utf8");
    const out: Baseline = {};
    // oxfmt 会去掉合法标识符键的引号，两种键形式都要认。
    const re = /(?:"([^"]+)"|([A-Za-z_$][\w$]*)):\s*\[([^\]]*)\]/g;
    for (const match of text.matchAll(re)) {
      const name = match[1] ?? match[2];
      if (!name) continue;
      out[name] = [...(match[3] ?? "").matchAll(/"([^"]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : []));
    }
    return out;
  } catch {
    return {};
  }
}

function renderBaseline(baseline: Baseline): string {
  const lines = [
    "/**",
    " * 层依赖存量基线（棘轮）—— 由 `bun scripts/check-layer-deps.ts --update` 生成，勿手改。",
    " *",
    ' * `"<from> -> <to>"` → 允许存在该层对违规的仓库相对文件清单。',
    " * 只减不增；新文件出现违规即失败（oxlint `freeanima/layer-deps` 与",
    " * `scripts/check-layer-deps.ts` 共用本表）。",
    " */",
    "export const LAYER_DEPS_BASELINE: Readonly<Record<string, readonly string[]>> = {",
  ];
  for (const [key, entries] of Object.entries(baseline).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`  ${JSON.stringify(key)}: [`);
    for (const entry of [...entries].toSorted()) lines.push(`    ${JSON.stringify(entry)},`);
    lines.push("  ],");
  }
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

const files: string[] = [];
collectFiles(join(REPO_ROOT, "packages"), files);
const fileSet: ReadonlySet<string> = new Set(files);

/**
 * 按文件存在性解算目标文件 —— `@freeanima/features/*` / `portal/*` 是双树别名，
 * 只有存在性解算才能把「UI→UI」与「UI→服务端特性」区分开；候选顺序与
 * `scripts/oxlint-plugins/freeanima/lib/layer-deps.ts` 的 `dualTreeLayer` 一致。
 */
function tryResolve(base: string): string | null {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function resolveTargetFile(fromFile: string, spec: string): string | null {
  if (spec.startsWith(".")) return tryResolve(resolve(dirname(fromFile), spec));
  if (!spec.startsWith("@freeanima/")) return null;
  const [head, ...tail] = spec.slice("@freeanima/".length).split("/");
  if (!head) return null;
  const candidates: string[] = [];
  const push = (...segments: string[]): void => {
    candidates.push(join(REPO_ROOT, "packages", ...segments, ...tail));
  };
  if (head === "features") {
    push("ui-features");
    push("features");
  } else if (head === "portal") {
    push("portal");
    push("cli");
  } else push(head);
  for (const candidate of candidates) {
    const resolved = tryResolve(candidate);
    if (resolved) return resolved;
  }
  return null;
}

const current: Baseline = {};
const examples = new Map<string, string[]>();

for (const file of files) {
  const rel = relative(REPO_ROOT, file).replaceAll("\\", "/");
  const from = layerOfPath(rel);
  if (!from) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const spec = match[3];
    if (!spec) continue;
    const targetFile = resolveTargetFile(file, spec);
    const to = targetFile
      ? layerOfPath(relative(REPO_ROOT, targetFile).replaceAll("\\", "/"))
      : targetLayer(rel, spec);
    if (!checkLayerEdge(from, to, spec)) continue;
    const key = `${from} -> ${to ?? "?"}`;
    const list = current[key] ?? [];
    if (!list.includes(rel)) list.push(rel);
    current[key] = list;
    const exampleList = examples.get(key) ?? [];
    if (exampleList.length < 2) exampleList.push(`${rel} → ${spec}`);
    examples.set(key, exampleList);
  }
}

for (const key of Object.keys(current)) current[key] = current[key]?.toSorted() ?? [];

if (PRINT || UPDATE) {
  console.log(JSON.stringify(current, null, 2));
  if (UPDATE) {
    writeFileSync(BASELINE_TS, renderBaseline(current), "utf8");
    const total = Object.values(current).reduce((sum, list) => sum + list.length, 0);
    console.log(
      `check-layer-deps: baseline updated (${Object.keys(current).length} 层对 / ${total} 文件)`,
    );
  }
} else {
  const baseline = readBaseline();
  const problems: string[] = [];
  for (const [key, entries] of Object.entries(current)) {
    const allowed = new Set(baseline[key] ?? []);
    for (const entry of entries) {
      if (!allowed.has(entry)) problems.push(`新增：${key} @ ${entry}`);
    }
  }
  if (problems.length > 0) {
    console.error("check-layer-deps: 出现新的层依赖违规");
    for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`);
    for (const [key, list] of examples) {
      if (problems.some((problem) => problem.includes(key))) {
        for (const example of list) console.error(`    ${key}: ${example}`);
      }
    }
    process.exit(1);
  }
  const total = Object.values(current).reduce((sum, list) => sum + list.length, 0);
  const shrinkable = Object.keys(baseline).filter((key) => {
    const now = new Set(current[key] ?? []);
    return (baseline[key] ?? []).some((entry) => !now.has(entry));
  });
  console.log(`check-layer-deps: ok（${Object.keys(current).length} 层对 / ${total} 文件存量）`);
  if (shrinkable.length > 0) {
    console.log(`  可收紧基线（跑 --update）：${shrinkable.join(", ")}`);
  }
}
