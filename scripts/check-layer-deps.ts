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
const RELATIVE_DEEP_IMPORT_RE =
  /from\s+["'](\.\.?\/(?:\.\.\/)*)(?:satellites\/|platform\/admin-frontend\/app\/)/g;

const LAYER_DIRS = [
  "kernel",
  "packages",
  "core",
  "runtime",
  "capabilities",
  "platform",
  "satellites",
  "app",
  "tests",
] as const;

const SATELLITE_ALLOWED = new Set([
  "sap-contract",
  "shell-sdk",
  "ui-kit",
  "kernel",
  "kernel-logging",
]);

const ADMIN_FRONTEND_ALLOWED = new Set([
  "admin-contract",
  "shell-sdk",
  "ui-kit",
  "kernel",
  "kernel-logging",
]);

const UI_KIT_ALLOWED = new Set(["kernel", "kernel-logging"]);

const SHELL_SDK_ALLOWED = new Set(["kernel", "kernel-logging"]);

type Layer = (typeof LAYER_DIRS)[number] | null;

function workspacePkgName(importPath: string): string {
  return importPath.split("/")[0] ?? importPath;
}

function layerOf(relPath: string): Layer {
  const top = relPath.split("/")[0];
  if ((LAYER_DIRS as readonly string[]).includes(top)) return top as Layer;
  return null;
}

function isAdminFrontendPath(relPath: string): boolean {
  return relPath.startsWith("platform/admin-frontend/");
}

function isAdminApiPath(relPath: string): boolean {
  return relPath.startsWith("platform/admin-api/");
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
  if (relPath.startsWith("app/cli/")) return true;
  if (
    relPath === "platform/admin-frontend/build-utils.ts" ||
    relPath === "packages/shell-ui/vite/run-build.ts" ||
    relPath === "packages/shell-ui/vite/satellite-vite.ts" ||
    relPath === "packages/shell-ui/vite/paths.ts" ||
    relPath === "platform/admin-frontend/paraglide-compile.ts"
  )
    return true;
  return false;
}

function isSatelliteAllowed(pkg: string): boolean {
  const root = workspacePkgName(pkg);
  if (SATELLITE_ALLOWED.has(root)) return true;
  if (root.startsWith("kernel-")) return true;
  return false;
}

function isAdminFrontendAllowed(pkg: string): boolean {
  const root = workspacePkgName(pkg);
  if (ADMIN_FRONTEND_ALLOWED.has(root)) return true;
  if (root.startsWith("kernel-")) return true;
  return false;
}

function isUiKitAllowed(pkg: string): boolean {
  const root = workspacePkgName(pkg);
  if (UI_KIT_ALLOWED.has(root)) return true;
  if (root.startsWith("kernel-")) return true;
  return false;
}

function isShellSdkAllowed(pkg: string): boolean {
  const root = workspacePkgName(pkg);
  if (SHELL_SDK_ALLOWED.has(root)) return true;
  if (root.startsWith("kernel-")) return true;
  return false;
}

function isShellUiAllowed(pkg: string): boolean {
  const root = workspacePkgName(pkg);
  if (root === "ui-kit") return true;
  if (root === "shell-sdk") return true;
  if (root === "admin-frontend") return true;
  if (root.startsWith("satellite-")) return true;
  if (root.startsWith("kernel-")) return true;
  if (root === "kernel") return true;
  return false;
}

function isAllowed(layer: Layer, pkg: string, relPath: string): boolean {
  if (!layer) return true;
  const root = workspacePkgName(pkg);

  if (isAdminFrontendPath(relPath)) {
    return isAdminFrontendAllowed(pkg);
  }

  if (isAdminApiPath(relPath)) {
    return true;
  }

  if (layer === "satellites") {
    return isSatelliteAllowed(pkg);
  }

  if (layer === "packages") {
    if (relPath.startsWith("packages/sap-contract")) {
      return root === "kernel" || root.startsWith("kernel-") || root === "sap-contract";
    }
    if (relPath.startsWith("packages/ui-kit")) {
      return isUiKitAllowed(pkg);
    }
    if (relPath.startsWith("packages/shell-sdk")) {
      return isShellSdkAllowed(pkg);
    }
    if (relPath.startsWith("packages/shell-ui")) {
      return isShellUiAllowed(pkg);
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
    case "app":
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
  if (layerOf(relPath) !== "satellites") return null;
  if (isSatelliteAllowed(pkg)) return null;
  return `satellites/* must not depend on @freeanima/${workspacePkgName(pkg)} (allowed: sap-contract, shell-sdk, ui-kit + generic deps)`;
}

function adminFrontendViolation(relPath: string, pkg: string): string | null {
  if (!isAdminFrontendPath(relPath)) return null;
  if (isAdminFrontendAllowed(pkg)) return null;
  return `platform/admin-frontend must not depend on @freeanima/${workspacePkgName(pkg)} (allowed: admin-contract, ui-kit, shell-sdk, kernel*)`;
}

function shellUiDeepImportViolation(
  relPath: string,
  line: string,
  lineNo: number,
): Violation | null {
  if (!relPath.startsWith("packages/shell-ui/")) return null;
  if (isExempt(relPath)) return null;
  RELATIVE_DEEP_IMPORT_RE.lastIndex = 0;
  if (!RELATIVE_DEEP_IMPORT_RE.test(line)) return null;
  return {
    file: relPath,
    line: lineNo,
    pkg: "relative-import",
    reason:
      "packages/shell-ui must not deep-import satellites/ or platform/admin-frontend/app/ (use @freeanima/satellite-*/app)",
  };
}

function reasonFor(layer: Layer, pkg: string): string {
  return `layer ${layer} must not depend on @freeanima/${workspacePkgName(pkg)}`;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === "coverage" || name === ".tsout")
      continue;
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
    if (!layer || layer === "tests") continue;

    const lines = readFileSync(abs, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const deep = shellUiDeepImportViolation(rel, line, i + 1);
      if (deep) {
        violations.push(deep);
      }
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
        const adminFeCross = adminFrontendViolation(rel, pkg);
        if (adminFeCross) {
          violations.push({ file: rel, line: i + 1, pkg, reason: adminFeCross });
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
      dir === "tests" || dir === "kernel"
        ? [{ name: ".", isDirectory: () => true }]
        : readdirSync(base, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgDir = dir === "tests" || dir === "kernel" ? base : join(base, ent.name);
      const nestedAdmin =
        dir === "platform" &&
        (ent.name === "admin-api" || ent.name === "admin-frontend" || ent.name === "admin-contract")
          ? pkgDir
          : null;
      const pjPath = join(nestedAdmin ?? pkgDir, "package.json");
      if (!existsSync(pjPath)) continue;
      const relDir = relative(ROOT, nestedAdmin ?? pkgDir);
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
        const adminFeCross = adminFrontendViolation(fakeLine, fakePkg);
        if (adminFeCross) {
          violations.push({ file: fakeLine, line: 0, pkg: fakePkg, reason: adminFeCross });
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
      if (dir === "tests" || dir === "kernel") break;
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
