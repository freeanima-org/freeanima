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
  "shared",
  "frontend",
  "core",
  "runtime",
  "capabilities",
  "features",
  "platform",
  "satellites",
  "app",
  "tests",
] as const;

const SATELLITE_ALLOWED = new Set([
  "sap-contract",
  "shell-sdk",
  "ui-kit",
  "vault-crypto",
  "kernel",
  "kernel-logging",
]);

const UI_KIT_ALLOWED = new Set(["kernel", "kernel-logging"]);

const SHELL_SDK_ALLOWED = new Set(["kernel", "kernel-logging", "hub-rpc", "vault-crypto"]);

type Layer = (typeof LAYER_DIRS)[number] | null;

function workspacePkgName(importPath: string): string {
  return importPath.split("/")[0] ?? importPath;
}

function layerOf(relPath: string): Layer {
  const top = relPath.split("/")[0] ?? "";
  if ((LAYER_DIRS as readonly string[]).includes(top)) return top as Layer;
  return null;
}

function isAdminApiPath(relPath: string): boolean {
  return relPath.startsWith("features/console/hub/admin-api/");
}

function sourceCapabilitiesPkg(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "capabilities" || parts.length < 2) return null;
  return parts[1] ?? null;
}

function sourceFeatureSlug(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "features" || parts.length < 2) return null;
  return parts[1] ?? null;
}

function isExempt(relPath: string): boolean {
  if (relPath.includes("/tests/")) return true;
  if (relPath.includes("/test-helpers/")) return true;
  if (/\.(test|spec)\.ts$/.test(relPath)) return true;
  if (relPath.startsWith("tests/")) return true;
  if (relPath.startsWith("app/cli/")) return true;
  if (
    relPath === "features/console/build/build-utils.ts" ||
    relPath === "frontend/shell-ui/vite/run-build.ts" ||
    relPath === "frontend/shell-ui/vite/satellite-vite.ts" ||
    relPath === "frontend/shell-ui/vite/paths.ts" ||
    relPath === "features/console/build/paraglide-compile.ts"
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
  if (root.startsWith("satellite-")) return true;
  if (root.startsWith("feature-")) return true;
  if (root.startsWith("kernel-")) return true;
  if (root === "kernel") return true;
  return false;
}

function isAllowed(layer: Layer, pkg: string, relPath: string): boolean {
  if (!layer) return true;
  const root = workspacePkgName(pkg);

  if (isAdminApiPath(relPath)) {
    return true;
  }

  if (layer === "satellites") {
    const satSlug = relPath.split("/")[1];
    if (root.startsWith("feature-") && satSlug && root === `feature-${satSlug}`) {
      return true;
    }
    return isSatelliteAllowed(pkg);
  }

  if (layer === "shared") {
    if (relPath.startsWith("shared/hub-rpc")) {
      return root === "kernel" || root.startsWith("kernel-") || root === "hub-rpc";
    }
    if (relPath.startsWith("shared/sap-contract")) {
      return (
        root === "kernel" ||
        root.startsWith("kernel-") ||
        root === "sap-contract" ||
        root === "hub-rpc"
      );
    }
    if (relPath.startsWith("shared/vault-crypto")) {
      return root === "kernel" || root.startsWith("kernel-") || root === "vault-crypto";
    }
    return false;
  }

  if (layer === "frontend") {
    if (relPath.startsWith("frontend/ui-kit")) {
      return isUiKitAllowed(pkg);
    }
    if (relPath.startsWith("frontend/shell-sdk")) {
      return isShellSdkAllowed(pkg);
    }
    if (relPath.startsWith("frontend/shell-ui")) {
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
      if (root.startsWith("feature-")) return false;
      return root.startsWith("kernel-") || root === "kernel" || root === "core";
    }
    case "features": {
      if (root === "runtime") return false;
      if (root === "platform") return true;
      if (root === "admin-api" || root === "admin-contract") return true;
      if (root === "vault-crypto") return true;
      if (root === "capabilities-memory") return true;
      if (root.startsWith("capabilities-")) return false;
      if (root.startsWith("feature-")) return false;
      if (root === "sap-contract") return true;
      if (root === "shell-sdk") return true;
      if (root === "ui-kit") return true;
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
  if (!root.startsWith("capabilities-")) {
    if (root.startsWith("feature-")) {
      return `capabilities/${srcPkg} must not depend on @freeanima/${root}`;
    }
    return null;
  }
  const importSlug = root.slice("capabilities-".length);
  if (importSlug === srcPkg) return null;
  return `capabilities/${srcPkg} must not depend on @freeanima/${root}`;
}

function featuresCrossViolation(relPath: string, pkg: string): string | null {
  if (layerOf(relPath) !== "features") return null;
  const srcSlug = sourceFeatureSlug(relPath);
  if (!srcSlug) return null;
  const root = workspacePkgName(pkg);
  if (!root.startsWith("feature-")) return null;
  const importSlug = root.slice("feature-".length);
  if (importSlug === srcSlug) return null;
  return `features/${srcSlug} must not depend on @freeanima/${root}`;
}

function satelliteViolation(relPath: string, pkg: string): string | null {
  if (layerOf(relPath) !== "satellites") return null;
  const root = workspacePkgName(pkg);
  if (root.startsWith("feature-")) {
    const satSlug = relPath.split("/")[1];
    if (satSlug && root === `feature-${satSlug}`) return null;
    return `satellites/* must not depend on @freeanima/${root}`;
  }
  if (isSatelliteAllowed(pkg)) return null;
  return `satellites/* must not depend on @freeanima/${root} (allowed: sap-contract, shell-sdk, ui-kit + generic deps)`;
}

function shellUiDeepImportViolation(
  relPath: string,
  line: string,
  lineNo: number,
): Violation | null {
  if (!relPath.startsWith("frontend/shell-ui/")) return null;
  if (isExempt(relPath)) return null;
  RELATIVE_DEEP_IMPORT_RE.lastIndex = 0;
  if (!RELATIVE_DEEP_IMPORT_RE.test(line)) return null;
  return {
    file: relPath,
    line: lineNo,
    pkg: "relative-import",
    reason:
      "frontend/shell-ui must not deep-import legacy satellite or admin app paths (use @freeanima/feature-*/ui/*)",
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
      while ((m = IMPORT_RE.exec(line)) != null) {
        const pkg = m[1] ?? "";
        const capCross = capabilitiesCrossViolation(rel, pkg);
        if (capCross) {
          violations.push({ file: rel, line: i + 1, pkg, reason: capCross });
          continue;
        }
        const featCross = featuresCrossViolation(rel, pkg);
        if (featCross) {
          violations.push({ file: rel, line: i + 1, pkg, reason: featCross });
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

const NESTED_WORKSPACE_PACKAGES = [
  "features/console/hub/admin-api",
  "features/console/protocol/admin-contract",
] as const;

function scanNestedWorkspacePackages(): Violation[] {
  const violations: Violation[] = [];
  for (const relDir of NESTED_WORKSPACE_PACKAGES) {
    const pjPath = join(ROOT, relDir, "package.json");
    if (!existsSync(pjPath)) continue;
    const manifest = JSON.parse(readFileSync(pjPath, "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      if (!dep.startsWith("@freeanima/")) continue;
      const fakePkg = dep.replace("@freeanima/", "");
      const fakeLine = join(relDir, "package.json");
      if (!isAllowed(layerOf(relDir), fakePkg, join(relDir, "src/index.ts"))) {
        violations.push({
          file: fakeLine,
          line: 0,
          pkg: fakePkg,
          reason: reasonFor(layerOf(relDir), fakePkg),
        });
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
        const featCross = featuresCrossViolation(fakeLine, fakePkg);
        if (featCross) {
          violations.push({ file: fakeLine, line: 0, pkg: fakePkg, reason: featCross });
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

const ALLOWED_SATELLITE_SLUGS = new Set(["companion", "pair-programming"]);

function scanSatelliteLayout(): Violation[] {
  const violations: Violation[] = [];
  const satellitesRoot = join(ROOT, "satellites");
  if (!existsSync(satellitesRoot)) return violations;
  for (const ent of readdirSync(satellitesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (!ALLOWED_SATELLITE_SLUGS.has(ent.name)) {
      violations.push({
        file: `satellites/${ent.name}`,
        line: 0,
        pkg: ent.name,
        reason: `satellites/ may only contain companion and pair-programming (found ${ent.name})`,
      });
    }
  }
  return violations;
}

const violations = [
  ...scanImports(),
  ...scanPackageJson(),
  ...scanNestedWorkspacePackages(),
  ...scanSatelliteLayout(),
];
if (violations.length === 0) {
  console.log("dep-check: OK");
  process.exit(0);
}

console.error(`dep-check: ${violations.length} violation(s)`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} — ${v.reason}`);
}
process.exit(1);
