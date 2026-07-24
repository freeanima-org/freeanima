#!/usr/bin/env bun
/**
 * Bun SQL 不能把 JS string[] 可靠绑成 PG text[]。
 * 禁止在 sql / drizzleSql 片段里对 array 消费算子裸绑变量：
 *   ANY(${ids}) / ?| ${ids} / ?& ${ids} / && ${ids}
 * 须用 pgTextArray(...) 或 ARRAY[${scalar},…]::text[]。
 *
 *   bun scripts/check-pg-sql-arrays.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const SCAN_ROOT = join(REPO_ROOT, "src/host/core/db/pg");
const SOURCE_EXT = /\.(ts|tsx)$/;

/** sql`…` / drizzleSql`…` 模板（非嵌套扫描；够用） */
const SQL_TEMPLATE_RE = /(?:sql|drizzleSql)`((?:[^`\\]|\\.)*)`/gs;

/**
 * array 消费算子 + ${expr}。
 * 允许：pgTextArray(...)、内含 ARRAY[ 的展开（含嵌套 sql`ARRAY[…]`）。
 */
const ARRAY_OP_BIND_RE = /(?:(?:^|[^$\w])ANY\s*\(|\?[|&]|\s&&\s)\s*\$\{([^}]+)\}/g;

type Violation = { file: string; line: number; expr: string; snippet: string };

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
      continue;
    }
    if (SOURCE_EXT.test(entry)) out.push(full);
  }
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function isSafePgArrayBinding(expr: string): boolean {
  const t = expr.replace(/\s+/g, " ").trim();
  if (/\bpgTextArray\s*\(/.test(t)) return true;
  if (/ARRAY\s*\[/.test(t)) return true;
  return false;
}

export function collectPgSqlArrayViolations(filePath: string, text: string): Violation[] {
  const rel = relative(REPO_ROOT, filePath);
  const violations: Violation[] = [];
  for (const tm of text.matchAll(SQL_TEMPLATE_RE)) {
    const body = tm[1] ?? "";
    const bodyOffset = (tm.index ?? 0) + (tm[0]?.indexOf("`") ?? 0) + 1;
    for (const bm of body.matchAll(ARRAY_OP_BIND_RE)) {
      const expr = (bm[1] ?? "").trim();
      if (!expr || isSafePgArrayBinding(expr)) continue;
      const abs = bodyOffset + (bm.index ?? 0);
      violations.push({
        file: rel,
        line: lineOf(text, abs),
        expr,
        snippet: body.replace(/\s+/g, " ").trim().slice(0, 120),
      });
    }
  }
  return violations;
}

function selfTest(): void {
  const cases: Array<{ ok: boolean; expr: string }> = [
    { ok: true, expr: "pgTextArray(ids)" },
    { ok: true, expr: "sql`ARRAY[${v}]::text[]`" },
    { ok: false, expr: "ids" },
    { ok: false, expr: "[...ids]" },
  ];
  for (const c of cases) {
    if (isSafePgArrayBinding(c.expr) !== c.ok) {
      throw new Error(`self-test isSafePgArrayBinding(${JSON.stringify(c.expr)})`);
    }
  }
  const bad = collectPgSqlArrayViolations(
    "virtual.ts",
    "sql`x = ANY(${ids})`;\nsql`(b) ?| ${ids}`;",
  );
  if (bad.length !== 2) throw new Error(`self-test expected 2 violations, got ${bad.length}`);
  const good = collectPgSqlArrayViolations(
    "virtual.ts",
    "sql`x = ANY(${pgTextArray(ids)})`;\nsql`(b) ?| ${pgTextArray(ids)}`;",
  );
  if (good.length > 0) throw new Error(`self-test expected 0 violations, got ${good.length}`);
  console.log("pg-sql-arrays: self-test ok");
}

function main(): void {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const files: string[] = [];
  walk(SCAN_ROOT, files);
  const all = files.flatMap((f) => collectPgSqlArrayViolations(f, readFileSync(f, "utf-8")));
  if (all.length > 0) {
    console.error(`pg-sql-arrays: ${all.length} violation(s)`);
    console.error(
      "  Bun SQL：勿将 JS string[] 直接绑给 ANY / ?| / ?& / &&；改用 pgTextArray(...) 或 ARRAY[${v},…]::text[]",
    );
    console.error("  见 .agent/rules/drizzle-db.md § Bun SQL text[]");
    for (const v of all.slice(0, 40)) {
      console.error(`  ${v.file}:${v.line}: \${${v.expr}}`);
      console.error(`    ${v.snippet}`);
    }
    if (all.length > 40) console.error(`  … and ${all.length - 40} more`);
    process.exit(1);
  }
  console.log(`pg-sql-arrays: ok (${files.length} files)`);
}

if (import.meta.main) main();
