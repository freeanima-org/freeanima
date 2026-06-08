#!/usr/bin/env bun
/**
 * 层边界依赖检查：扫描 @freeanima/* import 是否符合架构规则。
 * 测试与 test-helpers 目录豁免。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

type Violation = { file: string; line: number; pkg: string; reason: string };

const IMPORT_RE = /from\s+["']@freeanima\/([^"']+)["']/g;

function isExempt(relPath: string): boolean {
  if (relPath.includes("/tests/")) return true;
  if (relPath.includes("/test-helpers/")) return true;
  if (/\.(test|spec)\.ts$/.test(relPath)) return true;
  if (relPath.startsWith("tests/")) return true;
  if (relPath.startsWith("cli/")) return true;
  return false;
}

function layerOf(relPath: string): string | null {
  const top = relPath.split("/")[0];
  if (
    top === "kernel" ||
    top === "engine" ||
    top === "life" ||
    top === "capabilities" ||
    top === "connectors" ||
    top === "service"
  ) {
    return top;
  }
  return null;
}

function isAllowed(layer: string, pkg: string, _relPath: string): boolean {
  switch (layer) {
    case "kernel":
      return pkg.startsWith("kernel-") || pkg === "kernel";
    case "engine":
      if (pkg.startsWith("kernel-") || pkg === "kernel") return true;
      if (pkg.startsWith("engine-") || pkg === "engine") return true;
      if (pkg === "service-config" || pkg === "service-logging") return true;
      if (pkg.startsWith("capabilities-provider")) return true;
      if (pkg === "connectors-db-pg") return false;
      return false;
    case "life":
      if (pkg.startsWith("kernel-") || pkg === "kernel") return true;
      if (pkg.startsWith("life-") || pkg === "life") return true;
      if (pkg.startsWith("engine-tool")) return true;
      if (pkg === "engine-repos") return true;
      if (pkg === "connectors-db-pg") return false;
      if (pkg === "service-config" || pkg === "service-logging") return true;
      return false;
    case "capabilities":
      if (pkg.startsWith("kernel-") || pkg === "kernel") return true;
      if (pkg.startsWith("engine-") || pkg === "engine") return true;
      if (pkg.startsWith("capabilities-") || pkg === "capabilities") return true;
      if (pkg.startsWith("life-memory")) return true;
      if (pkg === "connectors-redis") return true;
      if (pkg === "service-config" || pkg === "service-logging") return true;
      return false;
    case "connectors":
      if (pkg === "service") return false;
      return true;
    case "service":
      return true;
    default:
      return true;
  }
}

function reasonFor(layer: string, pkg: string): string {
  return `层 ${layer} 不允许依赖 @freeanima/${pkg}`;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "coverage") continue;
      walk(abs, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(abs);
    }
  }
}

function scan(): Violation[] {
  const violations: Violation[] = [];
  const files: string[] = [];
  for (const dir of ["kernel", "engine", "life", "capabilities", "connectors", "service"]) {
    const abs = join(ROOT, dir);
    try {
      walk(abs, files);
    } catch {
      /* missing dir */
    }
  }

  for (const abs of files) {
    const rel = relative(ROOT, abs);
    if (isExempt(rel)) continue;
    const layer = layerOf(rel);
    if (!layer) continue;

    const content = readFileSync(abs, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      IMPORT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = IMPORT_RE.exec(line)) !== null) {
        const pkg = m[1] ?? "";
        if (!isAllowed(layer, pkg, rel)) {
          violations.push({
            file: rel,
            line: i + 1,
            pkg,
            reason: reasonFor(layer, pkg),
          });
        }
      }
    }
  }
  return violations;
}

const violations = scan();
if (violations.length === 0) {
  console.log("dep-check: OK");
  process.exit(0);
}

console.error(`dep-check: ${violations.length} violation(s)`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} — ${v.reason}`);
}
process.exit(1);
