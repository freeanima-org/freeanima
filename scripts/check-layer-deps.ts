#!/usr/bin/env bun
/**
 * Layer boundary dependency check: scan @freeanima/* imports against eight-layer architecture rules.
 * Tests and test-helpers directories are exempt.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

type Violation = { file: string; line: number; pkg: string; reason: string };

const IMPORT_RE = /from\s+["']@freeanima\/([^"']+)["']/g;

const LAYER_DIRS = [
  "kernel",
  "storage",
  "mechanism",
  "orchestration",
  "capabilities",
  "connectors",
  "service",
  "cli",
  "tests",
] as const;

type Layer = (typeof LAYER_DIRS)[number] | null;

function workspacePkgName(importPath: string): string {
  return importPath.split("/")[0] ?? importPath;
}

function layerOf(relPath: string): Layer {
  const top = relPath.split("/")[0];
  if ((LAYER_DIRS as readonly string[]).includes(top)) return top as Layer;
  return null;
}

function sourceCapabilitiesPkg(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "capabilities" || parts.length < 2) return null;
  return parts[1] ?? null;
}

function isExempt(relPath: string): boolean {
  if (relPath.includes("/tests/")) return true;
  if (relPath.includes("/test-helpers/")) return true;
  if (/\.(test|spec)\.ts$/.test(relPath)) return true;
  if (relPath.startsWith("tests/")) return true;
  if (relPath.startsWith("cli/")) return true;
  return false;
}

const ORCHESTRATION_PKG = new Set([
  "orchestration-session",
  "orchestration-turn",
  "orchestration-conversation",
  "orchestration-loop",
  "orchestration-runtime",
]);

const ORCHESTRATION_ALLOWS: Record<string, ReadonlySet<string>> = {
  "orchestration-turn": new Set(["orchestration-session"]),
  "orchestration-conversation": new Set(["orchestration-session", "orchestration-turn"]),
  "orchestration-runtime": new Set([
    "orchestration-session",
    "orchestration-turn",
    "orchestration-conversation",
    "orchestration-loop",
  ]),
};

function orchestrationViolation(sourcePkg: string | null, importRoot: string): string | null {
  if (!ORCHESTRATION_PKG.has(sourcePkg ?? "") && sourcePkg !== "orchestration-runtime") {
    if (sourcePkg === "orchestration-loop" && importRoot === "orchestration-conversation") {
      return "orchestration-loop must not depend on orchestration-conversation";
    }
    if (sourcePkg && ORCHESTRATION_PKG.has(sourcePkg) && importRoot !== sourcePkg) {
      const allowed = ORCHESTRATION_ALLOWS[sourcePkg];
      if (allowed?.has(importRoot)) return null;
      if (ORCHESTRATION_PKG.has(importRoot)) {
        return `orchestration: ${sourcePkg} must not depend on ${importRoot}`;
      }
    }
  }
  return null;
}

function sourceOrchestrationPkg(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "orchestration" || parts.length < 2) return null;
  const dir = parts[1];
  if (dir === "runtime") return "orchestration-runtime";
  return `orchestration-${dir}`;
}

function isAllowed(layer: Layer, pkg: string, _relPath: string): boolean {
  if (!layer) return true;
  const root = workspacePkgName(pkg);

  switch (layer) {
    case "kernel":
      return root.startsWith("kernel-") || root === "kernel";
    case "storage":
      return root.startsWith("kernel-") || root === "kernel" || root.startsWith("storage-");
    case "mechanism":
      if (root.startsWith("orchestration-")) return false;
      if (root.startsWith("service")) return false;
      if (root.startsWith("connectors-")) return false;
      if (root.startsWith("capabilities-") && !root.startsWith("capabilities-provider-"))
        return false;
      return (
        root.startsWith("kernel-") ||
        root === "kernel" ||
        root.startsWith("storage-") ||
        root.startsWith("mechanism-") ||
        root.startsWith("capabilities-provider-")
      );
    case "orchestration":
      if (root === "service") return false;
      if (root.startsWith("capabilities-")) return false;
      if (root.startsWith("connectors-")) return false;
      return (
        root.startsWith("kernel-") ||
        root === "kernel" ||
        root.startsWith("storage-") ||
        root.startsWith("mechanism-") ||
        root.startsWith("orchestration-")
      );
    case "capabilities": {
      if (root.startsWith("orchestration-")) return false;
      if (root.startsWith("service")) return false;
      if (root === "connectors-redis") return true;
      if (root.startsWith("connectors-")) return false;
      if (root.startsWith("capabilities-")) return true;
      return (
        root.startsWith("kernel-") ||
        root === "kernel" ||
        root.startsWith("storage-") ||
        root.startsWith("mechanism-")
      );
    }
    case "connectors":
      return root !== "service";
    case "service":
    case "cli":
    case "tests":
      return true;
    default:
      return true;
  }
}

function capabilitiesCrossViolation(relPath: string, pkg: string): string | null {
  if (layerOf(relPath) !== "capabilities") return null;
  const srcPkg = sourceCapabilitiesPkg(relPath);
  if (!srcPkg) return null;
  const root = workspacePkgName(pkg);
  if (!root.startsWith("capabilities-")) return null;
  const importSlug = root.slice("capabilities-".length);
  if (importSlug === srcPkg) return null;
  return `capabilities/${srcPkg} must not depend on @freeanima/${root}`;
}

function reasonFor(layer: Layer, pkg: string): string {
  return `layer ${layer} must not depend on @freeanima/${workspacePkgName(pkg)}`;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === "coverage") continue;
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(abs);
  }
}

function scanImports(): Violation[] {
  const violations: Violation[] = [];
  const files: string[] = [];
  for (const dir of LAYER_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    walk(abs, files);
  }

  for (const abs of files) {
    const rel = relative(ROOT, abs);
    if (isExempt(rel)) continue;
    const layer = layerOf(rel);
    if (!layer || layer === "cli" || layer === "tests") continue;

    const lines = readFileSync(abs, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      IMPORT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = IMPORT_RE.exec(line)) !== null) {
        const pkg = m[1] ?? "";
        const capCross = capabilitiesCrossViolation(rel, pkg);
        if (capCross) {
          violations.push({ file: rel, line: i + 1, pkg, reason: capCross });
          continue;
        }
        if (!isAllowed(layer, pkg, rel)) {
          violations.push({ file: rel, line: i + 1, pkg, reason: reasonFor(layer, pkg) });
          continue;
        }
        if (layer === "orchestration") {
          const srcPkg = sourceOrchestrationPkg(rel);
          const importRoot = workspacePkgName(pkg);
          const orchErr = orchestrationViolation(srcPkg, importRoot);
          if (orchErr) {
            violations.push({ file: rel, line: i + 1, pkg, reason: orchErr });
          }
        }
      }
    }
  }
  return violations;
}

function scanPackageJson(): Violation[] {
  const violations: Violation[] = [];
  for (const dir of LAYER_DIRS) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;
    const entries =
      dir === "cli" || dir === "tests" || dir === "kernel"
        ? [{ name: ".", isDirectory: () => true }]
        : readdirSync(base, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgDir =
        dir === "cli" || dir === "tests" || dir === "kernel" ? base : join(base, ent.name);
      const pjPath = join(pkgDir, "package.json");
      if (!existsSync(pjPath)) continue;
      const relDir = relative(ROOT, pkgDir);
      const manifest = JSON.parse(readFileSync(pjPath, "utf-8")) as {
        dependencies?: Record<string, string>;
      };
      for (const dep of Object.keys(manifest.dependencies ?? {})) {
        if (!dep.startsWith("@freeanima/")) continue;
        const fakePkg = dep.replace("@freeanima/", "");
        const fakeLine = join(relDir, "package.json");
        const capCross = capabilitiesCrossViolation(fakeLine, fakePkg);
        if (capCross) {
          violations.push({ file: fakeLine, line: 0, pkg: fakePkg, reason: capCross });
          continue;
        }
        if (!isAllowed(layerOf(relDir), fakePkg, join(relDir, "src/index.ts"))) {
          violations.push({
            file: fakeLine,
            line: 0,
            pkg: fakePkg,
            reason: reasonFor(layerOf(relDir), fakePkg),
          });
        }
      }
      if (dir === "cli" || dir === "tests") break;
    }
  }
  return violations;
}

const violations = [...scanImports(), ...scanPackageJson()];
if (violations.length === 0) {
  console.log("dep-check: OK");
  process.exit(0);
}

console.error(`dep-check: ${violations.length} violation(s)`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} — ${v.reason}`);
}
process.exit(1);
