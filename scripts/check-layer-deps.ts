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
const RELATIVE_DEEP_IMPORT_RE = /from\s+["'](\.\.?\/(?:\.\.\/)*)(?:satellites\/)/g;

const LAYER_DIRS = [
  "src/kernel",
  "src/shared",
  "src/frontend",
  "src/core",
  "src/runtime",
  "src/capabilities",
  "src/features",
  "src/platform",
  "src/satellites",
  "src/app",
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

type Layer =
  | "kernel"
  | "shared"
  | "frontend"
  | "core"
  | "runtime"
  | "capabilities"
  | "features"
  | "platform"
  | "satellites"
  | "app"
  | "tests"
  | null;

const LAYER_NAMES = new Set([
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
]);

function layerOf(relPath: string): Layer {
  const parts = relPath.split("/");
  if (parts[0] === "tests") return "tests";
  if (parts[0] === "src" && parts[1] && LAYER_NAMES.has(parts[1])) {
    return parts[1] as Layer;
  }
  return null;
}

function workspacePkgName(importPath: string): string {
  return importPath.split("/")[0] ?? importPath;
}

function isConsoleApiPath(relPath: string): boolean {
  return relPath.startsWith("src/features/console/hub/console-api/");
}

function sourceCapabilitiesPkg(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "src" || parts[1] !== "capabilities" || parts.length < 3) return null;
  return parts[2] ?? null;
}

function sourceFeatureSlug(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "src" || parts[1] !== "features" || parts.length < 3) return null;
  return parts[2] ?? null;
}

function isExempt(relPath: string): boolean {
  if (relPath.includes("/tests/")) return true;
  if (relPath.includes("/test-helpers/")) return true;
  if (/\.(test|spec)\.ts$/.test(relPath)) return true;
  if (relPath.startsWith("tests/")) return true;
  if (relPath.startsWith("src/app/cli/")) return true;
  if (
    relPath === "src/features/console/build/build-utils.ts" ||
    relPath === "src/frontend/shell-ui/vite/run-build.ts" ||
    relPath === "src/frontend/shell-ui/vite/satellite-vite.ts" ||
    relPath === "src/frontend/shell-ui/vite/paths.ts" ||
    relPath === "src/features/console/build/paraglide-compile.ts"
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

  if (isConsoleApiPath(relPath)) {
    return true;
  }

  if (layer === "satellites") {
    const satSlug = relPath.split("/")[2];
    if (root.startsWith("feature-") && satSlug && root === `feature-${satSlug}`) {
      return true;
    }
    return isSatelliteAllowed(pkg);
  }

  if (layer === "shared") {
    if (relPath.startsWith("src/shared/hub-rpc")) {
      return root === "kernel" || root.startsWith("kernel-") || root === "hub-rpc";
    }
    if (relPath.startsWith("src/shared/sap-contract")) {
      return (
        root === "kernel" ||
        root.startsWith("kernel-") ||
        root === "sap-contract" ||
        root === "hub-rpc"
      );
    }
    if (relPath.startsWith("src/shared/hub-contract")) {
      return (
        root === "kernel" ||
        root.startsWith("kernel-") ||
        root === "hub-contract" ||
        root === "sap-contract" ||
        root === "core"
      );
    }
    if (relPath.startsWith("src/shared/hub-client")) {
      return (
        root === "kernel" ||
        root.startsWith("kernel-") ||
        root === "hub-client" ||
        root === "hub-contract" ||
        root === "hub-rpc"
      );
    }
    if (relPath.startsWith("src/shared/vault-crypto")) {
      return root === "kernel" || root.startsWith("kernel-") || root === "vault-crypto";
    }
    return false;
  }

  if (layer === "frontend") {
    if (relPath.startsWith("src/frontend/ui-kit")) {
      return isUiKitAllowed(pkg);
    }
    if (relPath.startsWith("src/frontend/shell-sdk")) {
      return isShellSdkAllowed(pkg);
    }
    if (relPath.startsWith("src/frontend/shell-ui")) {
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
      if (root === "console-api" || root === "console-contract") return true;
      if (root === "vault-crypto") return true;
      if (root === "capabilities-memory") return true;
      if (root.startsWith("capabilities-")) return false;
      if (root.startsWith("feature-")) return false;
      if (root === "sap-contract") return true;
      if (root === "hub-contract") return true;
      if (root === "hub-client") return true;
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
      return `src/capabilities/${srcPkg} must not depend on @freeanima/${root}`;
    }
    return null;
  }
  const importSlug = root.slice("capabilities-".length);
  if (importSlug === srcPkg) return null;
  return `src/capabilities/${srcPkg} must not depend on @freeanima/${root}`;
}

function featuresCrossViolation(relPath: string, pkg: string): string | null {
  if (layerOf(relPath) !== "features") return null;
  const srcSlug = sourceFeatureSlug(relPath);
  if (!srcSlug) return null;
  const root = workspacePkgName(pkg);
  if (!root.startsWith("feature-")) return null;
  const importSlug = root.slice("feature-".length);
  if (importSlug === srcSlug) return null;
  return `src/features/${srcSlug} must not depend on @freeanima/${root}`;
}

function satelliteViolation(relPath: string, pkg: string): string | null {
  if (layerOf(relPath) !== "satellites") return null;
  const root = workspacePkgName(pkg);
  if (root.startsWith("feature-")) {
    const satSlug = relPath.split("/")[2];
    if (satSlug && root === `feature-${satSlug}`) return null;
    return `src/satellites/* must not depend on @freeanima/${root}`;
  }
  if (isSatelliteAllowed(pkg)) return null;
  return `src/satellites/* must not depend on @freeanima/${root} (allowed: sap-contract, shell-sdk, ui-kit + generic deps)`;
}

function shellUiDeepImportViolation(
  relPath: string,
  line: string,
  lineNo: number,
): Violation | null {
  if (!relPath.startsWith("src/frontend/shell-ui/")) return null;
  if (isExempt(relPath)) return null;
  RELATIVE_DEEP_IMPORT_RE.lastIndex = 0;
  if (!RELATIVE_DEEP_IMPORT_RE.test(line)) return null;
  return {
    file: relPath,
    line: lineNo,
    pkg: "relative-import",
    reason:
      "src/frontend/shell-ui must not deep-import legacy satellite paths (use @freeanima/feature-*/ui/*)",
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
        const featCross = isConsoleApiPath(rel) ? null : featuresCrossViolation(rel, pkg);
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

const ALLOWED_SATELLITE_SLUGS = new Set(["companion"]);

function scanSatelliteLayout(): Violation[] {
  const violations: Violation[] = [];
  const satellitesRoot = join(ROOT, "src/satellites");
  if (!existsSync(satellitesRoot)) return violations;
  for (const ent of readdirSync(satellitesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (!ALLOWED_SATELLITE_SLUGS.has(ent.name)) {
      violations.push({
        file: `src/satellites/${ent.name}`,
        line: 0,
        pkg: ent.name,
        reason: `src/satellites/ may only contain companion (found ${ent.name})`,
      });
    }
  }
  return violations;
}

const violations = [...scanImports(), ...scanSatelliteLayout()];
if (violations.length === 0) {
  console.log("dep-check: OK");
  process.exit(0);
}

console.error(`dep-check: ${violations.length} violation(s)`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} — ${v.reason}`);
}
process.exit(1);
