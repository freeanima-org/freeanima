#!/usr/bin/env bun
/**
 * 层依赖护栏（Phase 1 host/client/ui-kit）。
 *
 *   bun scripts/check-layer-deps.ts
 *   bun scripts/check-layer-deps.ts --warn   # 仅警告，exit 0
 *
 * 规则摘要见仓库 code-layers；本脚本 enforce：
 * - feature-ui / client spa 不得直引 host 栈
 * - host 不得引 client / ui-kit（少量 habitat client re-export 豁免）
 * - shared 不得引 ui-kit / client
 * - ui-kit 不得引 features / host / app-frame
 * - features 不得引 app-frame
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const WARN_ONLY = process.argv.includes("--warn");
const SOURCE_EXT = /\.(ts|tsx)$/;
const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

type Violation = { file: string; spec: string; rule: string };

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (
        entry === "node_modules" ||
        entry === "dist" ||
        entry === ".turbo" ||
        entry === ".tsout" ||
        entry === "admin-api" ||
        entry === "admin-contract" ||
        entry === "admin-frontend"
      ) {
        continue;
      }
      walk(full, out);
      continue;
    }
    if (SOURCE_EXT.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
      out.push(full);
    }
  }
}

function layerOf(rel: string): string {
  if (rel.startsWith("src/ui-kit/") || rel.startsWith("src/ui-kit/")) return "ui-kit";
  if (rel.startsWith("src/client/") || rel.startsWith("src/frontend/")) return "client";
  if (rel.startsWith("src/shared/")) return "shared";
  if (rel.startsWith("src/host/")) return "host";
  if (
    rel.startsWith("src/host/kernel/") ||
    rel.startsWith("src/host/core/") ||
    rel.startsWith("src/host/engine/") ||
    rel.startsWith("src/host/capabilities/") ||
    rel.startsWith("src/host/platform/")
  ) {
    return "host";
  }
  if (rel.startsWith("src/features/")) {
    if (rel.includes("/ui/")) return "feature-ui";
    return "feature-server";
  }
  if (rel.startsWith("src/app/shell/")) return "client";
  if (rel.startsWith("src/app/cli/")) return "host";
  return "other";
}

function targetLayer(spec: string): string | null {
  if (!spec.startsWith("@freeanima/")) return null;
  const rest = spec.slice("@freeanima/".length);
  if (rest.startsWith("ui-kit") || rest.startsWith("frontend/ui-kit")) return "ui-kit";
  if (rest.startsWith("client/") || rest.startsWith("frontend/")) return "client";
  if (rest.startsWith("shared/")) return "shared";
  if (rest.startsWith("host/")) return "host";
  if (
    rest.startsWith("kernel") ||
    rest.startsWith("core") ||
    rest.startsWith("runtime") ||
    rest.startsWith("capabilities") ||
    rest.startsWith("platform")
  ) {
    return "host";
  }
  if (rest.startsWith("features/")) {
    if (rest.includes("/ui/") || /features\/[^/]+\/ui\b/.test(rest)) return "feature-ui";
    return "feature-server";
  }
  return "other";
}

function check(rel: string, spec: string): string | null {
  const from = layerOf(rel);
  const to = targetLayer(spec);
  if (!to) return null;

  // feature-ui / client SPA 不得直引 platform/runtime/capabilities（core 工具/类型暂允许，后续再收）
  if ((from === "feature-ui" || (from === "client" && rel.includes("/spa/"))) && to === "host") {
    if (
      spec.includes("@freeanima/host/platform") ||
      spec.includes("@freeanima/host/engine") ||
      spec.includes("@freeanima/host/capabilities") ||
      spec.includes("@freeanima/platform") ||
      spec.includes("@freeanima/runtime") ||
      spec.includes("@freeanima/capabilities")
    ) {
      return "feature-ui/client-spa 不得 import platform/engine/capabilities；请经 portal-sdk";
    }
    return null;
  }

  // host 不得 → client / ui-kit（platform re-export portal-sdk 暂豁免 client.ts / feature-method-defs / install-client）
  if (from === "host" && (to === "client" || to === "ui-kit")) {
    if (
      rel.endsWith("platform/habitat/client.ts") ||
      rel.endsWith("platform/habitat/feature-method-defs.ts") ||
      rel.endsWith("platform/habitat/install-client-method-registry.ts")
    ) {
      return null;
    }
    return "host 不得 import client/ui-kit";
  }

  // shared 不得 → ui-kit / client / react 设计系统
  if (from === "shared" && (to === "ui-kit" || to === "client")) {
    return "shared 不得 import ui-kit/client（须无 React）";
  }

  // ui-kit 不得 → features / host / client app-frame
  if (from === "ui-kit" && (to === "feature-ui" || to === "feature-server" || to === "host")) {
    return "ui-kit 不得 import features/host";
  }
  if (
    from === "ui-kit" &&
    to === "client" &&
    (spec.includes("app-ui") || spec.includes("app-frame"))
  ) {
    return "ui-kit 不得 import app-frame";
  }

  // features 不得 → app-ui / app-frame
  if (
    (from === "feature-ui" || from === "feature-server") &&
    to === "client" &&
    (spec.includes("app-ui") || spec.includes("app-frame"))
  ) {
    return "features 不得 import app-frame";
  }

  return null;
}

const files: string[] = [];
walk(join(REPO_ROOT, "src"), files);

const violations: Violation[] = [];
for (const filePath of files) {
  const rel = relative(REPO_ROOT, filePath);
  const text = readFileSync(filePath, "utf-8");
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    const rule = check(rel, spec);
    if (rule) violations.push({ file: rel, spec, rule });
  }
}

if (violations.length === 0) {
  console.log("layer-deps: ok");
  process.exit(0);
}

const label = WARN_ONLY ? "warning" : "error";
console[WARN_ONLY ? "warn" : "error"](`layer-deps: ${violations.length} ${label}(s)`);
for (const v of violations.slice(0, 50)) {
  console[WARN_ONLY ? "warn" : "error"](`  ${v.file}: ${v.spec}`);
  console[WARN_ONLY ? "warn" : "error"](`    → ${v.rule}`);
}
if (violations.length > 50) {
  console[WARN_ONLY ? "warn" : "error"](`  … and ${violations.length - 50} more`);
}
process.exit(WARN_ONLY ? 0 : 1);
