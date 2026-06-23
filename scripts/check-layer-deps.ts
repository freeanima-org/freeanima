#!/usr/bin/env bun
/**
 * Layer boundary dependency check: scan @freeanima/* imports against layer architecture rules.
 * Tests and test-helpers directories are exempt.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

type Violation = { file: string; line: number; pkg: string; reason: string };

const IMPORT_RE = /from\s+["']@freeanima\/([^"']+)["']/g;

const LAYER_DIRS = [
  "kernel",
  "packages",
  "core",
  "runtime",
  "capabilities",
  "platform",
  "satellites",
  "frontends",
  "cli",
  "tests",
] as const;

const SATELLITE_ALLOWED = new Set(["sap-contract", "satellite-sdk", "kernel", "kernel-logging"]);

const DESKTOP_SHELL_ALLOWED = new Set([
  "sap-contract",
  "satellite-sdk",
  "satellite-companion",
  "satellite-chat",
  "frontend-chamber",
  "kernel",
  "kernel-logging",
]);

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

function isSatelliteAllowed(pkg: string): boolean {
  const root = workspacePkgName(pkg);
  if (SATELLITE_ALLOWED.has(root)) return true;
  if (root.startsWith("kernel-")) return true;
  return false;
}

function isAllowed(layer: Layer, pkg: string, relPath: string): boolean {
  if (!layer) return true;
  const root = workspacePkgName(pkg);

  if (layer === "satellites") {
    if (relPath.startsWith("satellites/desktop-shell/")) {
      const pkgRoot = workspacePkgName(pkg);
      if (DESKTOP_SHELL_ALLOWED.has(pkgRoot) || pkgRoot.startsWith("kernel-")) return true;
    }
    return isSatelliteAllowed(pkg);
  }

  if (layer === "frontends") {
    return isSatelliteAllowed(pkg);
  }

  if (layer === "packages") {
    if (relPath.startsWith("packages/sap-contract")) {
      return root === "kernel" || root.startsWith("kernel-") || root === "sap-contract";
    }
    if (relPath.startsWith("packages/satellite-sdk")) {
      return root === "kernel" || root.startsWith("kernel-");
    }
    return false;
  }

  switch (layer) {
    case "kernel":
      return root.startsWith("kernel-") || root === "kernel";
    case "core":
      return root.startsWith("kernel-") || root === "kernel" || root === "core";
    case "runtime":
      if (root === "platform") return false;
      if (root.startsWith("capabilities-")) return false;
      return (
        root.startsWith("kernel-") || root === "kernel" || root === "core" || root === "runtime"
      );
    case "capabilities": {
      if (root === "runtime" || root === "platform") return false;
      if (root === "sap-contract") return true;
      if (root.startsWith("capabilities-")) return true;
      return root.startsWith("kernel-") || root === "kernel" || root === "core";
    }
    case "platform":
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

function satelliteViolation(relPath: string, pkg: string): string | null {
  if (relPath.startsWith("satellites/desktop-shell/")) {
    const root = workspacePkgName(pkg);
    if (DESKTOP_SHELL_ALLOWED.has(root) || root.startsWith("kernel-")) return null;
    return `satellites/desktop-shell must not depend on @freeanima/${root}`;
  }
  if (layerOf(relPath) !== "satellites" && layerOf(relPath) !== "frontends") return null;
  if (isSatelliteAllowed(pkg)) return null;
  return `satellites/* / frontends/* must not depend on @freeanima/${workspacePkgName(pkg)} (allowed: sap-contract, satellite-sdk + generic deps)`;
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
        const satCross = satelliteViolation(rel, pkg);
        if (satCross) {
          violations.push({ file: rel, line: i + 1, pkg, reason: satCross });
          continue;
        }
        if (!isAllowed(layer, pkg, rel)) {
          violations.push({ file: rel, line: i + 1, pkg, reason: reasonFor(layer, pkg) });
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
        const satCross = satelliteViolation(fakeLine, fakePkg);
        if (satCross) {
          violations.push({ file: fakeLine, line: 0, pkg: fakePkg, reason: satCross });
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
      if (dir === "cli" || dir === "tests" || dir === "kernel") break;
    }
  }

  if (existsSync(join(ROOT, "satellites"))) {
    for (const ent of readdirSync(join(ROOT, "satellites"), { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const pjPath = join(ROOT, "satellites", ent.name, "package.json");
      if (!existsSync(pjPath)) continue;
      const manifest = JSON.parse(readFileSync(pjPath, "utf-8")) as {
        dependencies?: Record<string, string>;
      };
      for (const dep of Object.keys(manifest.dependencies ?? {})) {
        if (!dep.startsWith("@freeanima/")) continue;
        const fakePkg = dep.replace("@freeanima/", "");
        const satCross = satelliteViolation(`satellites/${ent.name}/package.json`, fakePkg);
        if (satCross) {
          violations.push({
            file: `satellites/${ent.name}/package.json`,
            line: 0,
            pkg: fakePkg,
            reason: satCross,
          });
        }
      }
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
