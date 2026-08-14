/**
 * 校验 shared/pg-shapes：无 drizzle / 无 host；生成物与 gen 一致。
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PG_SHAPES = join(REPO_ROOT, "packages/shared/pg-shapes");

const FORBIDDEN = [/drizzle-orm/, /@freeanima\/host\//];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function checkNoForbiddenImports(): void {
  const files = walk(PG_SHAPES);
  const bad: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const re of FORBIDDEN) {
      if (re.test(text)) bad.push(`${relative(REPO_ROOT, file)} matches ${re}`);
    }
  }
  if (bad.length > 0) {
    console.error("pg-shapes forbidden imports:\n" + bad.join("\n"));
    process.exit(1);
  }
}

function checkGeneratedFresh(): void {
  const r = spawnSync("bun", ["scripts/gen-shared-shapes/main.ts"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    process.exit(r.status ?? 1);
  }
  const fmt = spawnSync("bun", ["x", "oxfmt", "packages/shared/pg-shapes/rows"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (fmt.status !== 0) {
    console.error(fmt.stdout, fmt.stderr);
    process.exit(fmt.status ?? 1);
  }
  const diff = spawnSync("git", ["diff", "--exit-code", "--", "packages/shared/pg-shapes/rows"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (diff.status !== 0) {
    console.error(
      "pg-shapes rows drift — run `just db shapes` && bun x oxfmt packages/shared/pg-shapes/rows and commit.\n" +
        (diff.stdout || ""),
    );
    process.exit(1);
  }
}

checkNoForbiddenImports();
checkGeneratedFresh();
console.log("check-shared-shapes: ok");
