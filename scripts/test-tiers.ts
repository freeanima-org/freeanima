/**
 * core / enhanced 测试分层 SSOT 解析。
 * bun:test 无原生 tags；CORE 靠路径清单 + `*.core.test.ts` 约定。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function readLines(relPath: string): string[] {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) {
    throw new Error(`missing tier list: ${relPath}`);
  }
  return readFileSync(abs, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

function walkTestFiles(absDir: string, out: string[]): void {
  if (!existsSync(absDir)) return;
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const full = join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkTestFiles(full, out);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".test.tsx") ||
        entry.name.endsWith(".spec.ts"))
    ) {
      out.push(relative(repoRoot, full));
    }
  }
}

/** 集成 CORE 显式路径列表 */
export function listIntegrationCorePaths(): string[] {
  const paths = readLines("tests/tiers/integration-core.txt");
  const missing = paths.filter((p) => !existsSync(join(repoRoot, p)));
  if (missing.length > 0) {
    throw new Error(`integration CORE paths missing:\n${missing.join("\n")}`);
  }
  return paths;
}

/**
 * Unit CORE：路径默认表下的全部测试 + 任意 `*.core.test.ts`（含默认表外）。
 */
export function listUnitCorePaths(): string[] {
  const prefixes = readLines("tests/tiers/unit-core-globs.txt");
  const set = new Set<string>();

  for (const prefix of prefixes) {
    const abs = join(repoRoot, prefix);
    if (!existsSync(abs)) {
      throw new Error(`unit CORE path missing: ${prefix}`);
    }
    const st = statSync(abs);
    if (st.isFile()) {
      set.add(prefix);
      continue;
    }
    const found: string[] = [];
    walkTestFiles(abs, found);
    for (const f of found) set.add(f);
  }

  const coreNamed: string[] = [];
  walkTestFiles(join(repoRoot, "src"), coreNamed);
  for (const f of coreNamed) {
    if (
      f.endsWith(".core.test.ts") ||
      f.endsWith(".core.test.tsx") ||
      f.endsWith(".core.spec.ts")
    ) {
      set.add(f);
    }
  }

  return [...set].toSorted();
}

export function getRepoRoot(): string {
  return repoRoot;
}

/** CLI：print-unit-core | print-integration-core */
if (import.meta.main) {
  const cmd = process.argv[2] ?? "print-unit-core";
  if (cmd === "print-unit-core") {
    for (const p of listUnitCorePaths()) console.log(p);
  } else if (cmd === "print-integration-core") {
    for (const p of listIntegrationCorePaths()) console.log(p);
  } else {
    console.error(`usage: bun scripts/test-tiers.ts print-unit-core|print-integration-core`);
    process.exit(1);
  }
}
