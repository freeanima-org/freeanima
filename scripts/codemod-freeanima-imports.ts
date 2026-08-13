#!/usr/bin/env bun
/**
 * 全仓 import 迁移：短别名 + 逻辑包名 → @freeanima/* 物理路径。
 * 用法：bun scripts/codemod-freeanima-imports.ts [--dry-run]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const DRY_RUN = process.argv.includes("--dry-run");

/** 按前缀长度降序；先匹配更长规则 */
const PREFIX_REWRITES: [string, string][] = [
  // 短作用域别名
  ["@/", "@freeanima/features/companion/ui/spa/"],
  ["@chat/", "@freeanima/features/chat/ui/spa/"],
  ["@console/", "@freeanima/features/habitat/ui/habitat/"],
  ["@shared/", "@freeanima/features/companion/shared/"],
  ["@task/", "@freeanima/features/task/ui/spa/"],
  // capabilities 复合名（先于 capabilities- 单段）
  ["@freeanima/capabilities-tools/", "@freeanima/host/capabilities/tools/"],
  ["@freeanima/capabilities-satellite/", "@freeanima/host/capabilities/outpost/"],
  ["@freeanima/capabilities-llm-openai/", "@freeanima/host/capabilities/llm-openai/"],
  ["@freeanima/capabilities-mcp-client/", "@freeanima/host/capabilities/mcp-client/"],
  ["@freeanima/capabilities-mcp-server/", "@freeanima/host/capabilities/mcp-server/"],
  ["@freeanima/capabilities-memory/", "@freeanima/host/capabilities/memory/"],
  ["@freeanima/capabilities-acp/", "@freeanima/host/capabilities/acp/"],
  // feature / app / shared 逻辑包
  ["@freeanima/feature-", "@freeanima/features/"],
  ["@freeanima/satellite-companion/", "@freeanima/features/companion/"],
  ["@freeanima/app-desktop/", "@freeanima/portal/app/tauri/"],
  ["@freeanima/app-mobile/", "@freeanima/portal/app/tauri/"],
  ["@freeanima/app-web/", "@freeanima/portal/app/web/"],
  ["@freeanima/habitat-api/", "@freeanima/features/habitat/habitat/habitat-api/"],
  ["@freeanima/habitat-contract/", "@freeanima/features/habitat/protocol/habitat-contract/"],
  ["@freeanima/ui-kit/", "@freeanima/ui-kit/"],
  ["@freeanima/client/app-frame/", "@freeanima/client/app-frame/"],
  ["@freeanima/client/portal-sdk/", "@freeanima/client/portal-sdk/"],
  ["@freeanima/host/platform/commands/", "@freeanima/host/capabilities/tools/slash-commands/"],
  ["@freeanima/admin-api/", "@freeanima/features/habitat/habitat/habitat-api/"],
  ["@freeanima/admin-contract/", "@freeanima/features/habitat/protocol/habitat-contract/"],
  ["@freeanima/vault-crypto/", "@freeanima/shared/vault-crypto/"],
  // bare imports（精确匹配，无尾斜杠）
  ["@freeanima/capabilities-tools", "@freeanima/host/capabilities/tools"],
  ["@freeanima/capabilities-satellite", "@freeanima/host/capabilities/outpost"],
  ["@freeanima/capabilities-llm-openai", "@freeanima/host/capabilities/llm-openai"],
  ["@freeanima/capabilities-mcp-client", "@freeanima/host/capabilities/mcp-client"],
  ["@freeanima/capabilities-mcp-server", "@freeanima/host/capabilities/mcp-server"],
  ["@freeanima/capabilities-memory", "@freeanima/host/capabilities/memory"],
  ["@freeanima/capabilities-acp", "@freeanima/host/capabilities/acp"],
  ["@freeanima/capabilities-identity", "@freeanima/host/capabilities/self"],
  ["@freeanima/satellite-companion", "@freeanima/features/companion/lib"],
  ["@freeanima/habitat-api", "@freeanima/features/habitat/habitat/habitat-api"],
  ["@freeanima/habitat-api", "@freeanima/features/habitat/habitat/habitat-api"],
  ["@freeanima/habitat-contract", "@freeanima/features/habitat/protocol/habitat-contract"],
  ["@freeanima/ui-kit", "@freeanima/ui-kit"],
  ["@freeanima/client/app-frame", "@freeanima/client/app-frame/lib"],
  ["@freeanima/client/portal-sdk", "@freeanima/client/portal-sdk"],
  ["@freeanima/admin-api", "@freeanima/features/habitat/habitat/habitat-api"],
  ["@freeanima/admin-contract", "@freeanima/features/habitat/protocol/habitat-contract"],
  ["@freeanima/vault-crypto", "@freeanima/shared/vault-crypto"],
  ["@freeanima/feature-diary", "@freeanima/features/diary/domain"],
  ["@freeanima/feature-email", "@freeanima/features/email/domain"],
  ["@freeanima/feature-vault", "@freeanima/features/vault/domain"],
  ["@freeanima/feature-task", "@freeanima/features/task/domain"],
  ["@freeanima/feature-companion", "@freeanima/features/companion/domain"],
];

/** 旧 tsconfig override → 物理路径（前缀替换之后应用） */
const EXACT_REWRITES: Record<string, string> = {
  "@freeanima/ui-kit/ui/use-acp-progress-dock": "@freeanima/ui-kit/ui/useAcpProgressDock.ts",
  "@freeanima/ui-kit/ui/acp-types": "@freeanima/ui-kit/ui/acp-dock-types.ts",
  "@freeanima/ui-kit/ui/acp": "@freeanima/ui-kit/ui/AcpProgressDock.tsx",
  "@freeanima/ui-kit/globals.css": "@freeanima/ui-kit/styles/globals.css",
  "@freeanima/ui-kit/form": "@freeanima/ui-kit/form/FormFieldset.tsx",
  "@freeanima/features/companion/settings-section":
    "@freeanima/features/companion/ui/spa/settings/companion-settings-section.ts",
  "@freeanima/features/companion/settings-panel":
    "@freeanima/features/companion/ui/spa/settings/CompanionSettingsSection.tsx",
  "@freeanima/features/companion/settings-api":
    "@freeanima/features/companion/ui/spa/settings/companion-settings-api.ts",
  "@freeanima/features/companion/manifest": "@freeanima/features/companion/lib/exports/manifest.ts",
  "@freeanima/features/companion/desktop": "@freeanima/features/companion/lib/exports/desktop.ts",
  "@freeanima/features/companion/mobile": "@freeanima/features/companion/lib/exports/mobile.ts",
  "@freeanima/features/companion/build": "@freeanima/features/companion/lib/exports/build.ts",
  "@freeanima/features/habitat/ui/habitat/i18n":
    "@freeanima/features/habitat/ui/habitat/lib/i18n.ts",
  "@freeanima/features/habitat/ui/habitat/router":
    "@freeanima/features/habitat/ui/habitat/router.tsx",
  "@freeanima/host/kernel/logging/console": "@freeanima/host/kernel/logging/sinks/console.ts",
  "@freeanima/host/kernel/logging/file": "@freeanima/host/kernel/logging/sinks/file.ts",
  "@freeanima/host/kernel/logging/memory": "@freeanima/host/kernel/logging/sinks/memory.ts",
  "@freeanima/host/kernel/logging/null": "@freeanima/host/kernel/logging/sinks/null.ts",
  "@freeanima/client/app-frame/settings": "@freeanima/client/app-frame/lib/settings.ts",
  "@freeanima/client/app-frame/sentry-test": "@freeanima/client/app-frame/lib/sentry-test.ts",
  "@freeanima/client/app-frame/bootstrap/sentry":
    "@freeanima/client/app-frame/spa/bootstrap/sentry.ts",
  "@freeanima/client/app-frame/mount": "@freeanima/client/app-frame/spa/mount.tsx",
  "@freeanima/client/app-frame/build": "@freeanima/client/app-frame/build.ts",
  "@freeanima/portal/app/tauri/companion-settings-api":
    "@freeanima/portal/app/tauri/spa/companion-settings-api.ts",
  "@freeanima/portal/app/tauri/settings-registry":
    "@freeanima/portal/app/tauri/spa/settings-registry.ts",
  "@freeanima/portal/app/web/static-server": "@freeanima/portal/app/web/lib/static-server.ts",
  "@freeanima/features/habitat/protocol/habitat-contract/display-util":
    "@freeanima/features/habitat/protocol/habitat-contract/display-util.ts",
  "@freeanima/features/habitat/protocol/habitat-contract/date-json":
    "@freeanima/features/habitat/protocol/habitat-contract/date-json.ts",
  "@freeanima/shared/habitat-contract/schemas/habitat-schemas":
    "@freeanima/shared/habitat-contract/schemas/habitat-schemas.ts",
  "@freeanima/host/capabilities/acp/schemas/acp-jsonrpc":
    "@freeanima/host/capabilities/acp/schemas/acp-jsonrpc.ts",
  "@freeanima/host/capabilities/llm-openai/stream-tools":
    "@freeanima/host/capabilities/llm-openai/stream-tools.ts",
  "@freeanima/host/capabilities/llm-openai/messages":
    "@freeanima/host/capabilities/llm-openai/messages.ts",
  "@freeanima/host/capabilities/llm-openai/usage":
    "@freeanima/host/capabilities/llm-openai/usage.ts",
  "@freeanima/ui-kit/lib/merge-draft-after-save": "@freeanima/ui-kit/lib/merge-draft-after-save.ts",
  "@freeanima/ui-kit/lib/copy-text": "@freeanima/ui-kit/lib/copy-text.ts",
  "@freeanima/ui-kit/lib/utils": "@freeanima/ui-kit/lib/utils.ts",
  "@freeanima/host/core/tool/conversation-port": "@freeanima/host/core/tool/conversation-port.ts",
  "@freeanima/host/platform/bind-hosts": "@freeanima/host/platform/bind-hosts.ts",
  "@freeanima/host/platform/alive": "@freeanima/host/platform/alive.ts",
  "@freeanima/host/kernel/random-uuid": "@freeanima/host/kernel/random-uuid.ts",
  "@freeanima/client/portal-sdk/react": "@freeanima/client/portal-sdk/react.tsx",
  "@freeanima/features/habitat/build/build-utils":
    "@freeanima/features/habitat/build/build-utils.ts",
  "@freeanima/features/chat/ui/spa/styles.css": "@freeanima/features/chat/ui/spa/styles.css",
  "@freeanima/features/habitat/ui/habitat/styles.css":
    "@freeanima/features/habitat/ui/habitat/styles.css",
  "@freeanima/ui-kit/styles.css": "@freeanima/ui-kit/styles.css",
};

const IMPORT_SPEC_RE =
  /((?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"])([^'"]+)(['"])|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function rewriteSpec(spec: string): string {
  let current = spec;
  for (let round = 0; round < 8; round += 1) {
    const exact = EXACT_REWRITES[current];
    if (exact) {
      current = exact;
      continue;
    }
    let next = current;
    for (const [from, to] of PREFIX_REWRITES) {
      if (current === from || current.startsWith(from)) {
        next = to + current.slice(from.length);
        break;
      }
    }
    if (next === current) break;
    current = next;
  }
  const finalExact = EXACT_REWRITES[current];
  if (finalExact) return finalExact;
  return current;
}

function rewriteFileContent(text: string): { next: string; changed: boolean } {
  let changed = false;
  const next = text.replace(IMPORT_SPEC_RE, (match, _p1, spec1, _p3, spec2) => {
    const spec = spec1 ?? spec2;
    if (!spec) return match;
    const rewritten = rewriteSpec(spec);
    if (rewritten === spec) return match;
    changed = true;
    return match.replace(spec, rewritten);
  });
  return { next, changed };
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".turbo") continue;
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx|json|md)$/.test(entry)) out.push(full);
  }
}

const SCAN_ROOTS = [
  "src",
  "scripts",
  "tests",
  "types",
  ".agent",
  "docs",
  ".github",
  ".husky",
] as const;
const files: string[] = [];
for (const root of SCAN_ROOTS) {
  const abs = join(REPO_ROOT, root);
  if (statSync(abs, { throwIfNoEntry: false })?.isDirectory()) walk(abs, files);
}

// package.json / tsconfig at repo root
for (const f of ["package.json", "tsconfig.json"]) {
  const abs = join(REPO_ROOT, f);
  if (statSync(abs, { throwIfNoEntry: false })?.isFile()) files.push(abs);
}

let touched = 0;
for (const file of files) {
  const text = readFileSync(file, "utf-8");
  const { next, changed } = rewriteFileContent(text);
  if (!changed) continue;
  touched += 1;
  if (DRY_RUN) {
    console.log(`would update ${relative(REPO_ROOT, file)}`);
  } else {
    writeFileSync(file, next, "utf-8");
  }
}

console.log(DRY_RUN ? `dry-run: ${touched} files would change` : `updated ${touched} files`);
