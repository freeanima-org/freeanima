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
  ["@freeanima/capabilities-tools/", "@freeanima/capabilities/tools/"],
  ["@freeanima/capabilities-satellite/", "@freeanima/capabilities/remote-tools/"],
  ["@freeanima/capabilities-llm-openai/", "@freeanima/capabilities/llm-openai/"],
  ["@freeanima/capabilities-mcp-client/", "@freeanima/capabilities/mcp-client/"],
  ["@freeanima/capabilities-mcp-server/", "@freeanima/capabilities/mcp-server/"],
  ["@freeanima/capabilities-memory/", "@freeanima/capabilities/memory/"],
  ["@freeanima/capabilities-acp/", "@freeanima/capabilities/acp/"],
  // feature / app / shared 逻辑包
  ["@freeanima/feature-", "@freeanima/features/"],
  ["@freeanima/satellite-companion/", "@freeanima/features/companion/"],
  ["@freeanima/app-desktop/", "@freeanima/app/shell/tauri/"],
  ["@freeanima/app-mobile/", "@freeanima/app/shell/tauri/"],
  ["@freeanima/app-web/", "@freeanima/app/shell/web/"],
  ["@freeanima/habitat-api/", "@freeanima/features/habitat/habitat/habitat-api/"],
  ["@freeanima/habitat-contract/", "@freeanima/features/habitat/protocol/habitat-contract/"],
  ["@freeanima/ui-kit/", "@freeanima/frontend/ui-kit/"],
  ["@freeanima/frontend/app-ui/", "@freeanima/frontend/app-ui/"],
  ["@freeanima/frontend/portal-sdk/", "@freeanima/frontend/portal-sdk/"],
  ["@freeanima/platform/commands/", "@freeanima/platform/slash-commands/"],
  ["@freeanima/admin-api/", "@freeanima/features/habitat/habitat/habitat-api/"],
  ["@freeanima/admin-contract/", "@freeanima/features/habitat/protocol/habitat-contract/"],
  ["@freeanima/vault-crypto/", "@freeanima/shared/vault-crypto/"],
  // bare imports（精确匹配，无尾斜杠）
  ["@freeanima/capabilities-tools", "@freeanima/capabilities/tools"],
  ["@freeanima/capabilities-satellite", "@freeanima/capabilities/remote-tools"],
  ["@freeanima/capabilities-llm-openai", "@freeanima/capabilities/llm-openai"],
  ["@freeanima/capabilities-mcp-client", "@freeanima/capabilities/mcp-client"],
  ["@freeanima/capabilities-mcp-server", "@freeanima/capabilities/mcp-server"],
  ["@freeanima/capabilities-memory", "@freeanima/capabilities/memory"],
  ["@freeanima/capabilities-acp", "@freeanima/capabilities/acp"],
  ["@freeanima/capabilities-identity", "@freeanima/capabilities/identity"],
  ["@freeanima/satellite-companion", "@freeanima/features/companion/lib"],
  ["@freeanima/habitat-api", "@freeanima/features/habitat/habitat/habitat-api"],
  ["@freeanima/habitat-api", "@freeanima/features/habitat/habitat/habitat-api"],
  ["@freeanima/habitat-contract", "@freeanima/features/habitat/protocol/habitat-contract"],
  ["@freeanima/ui-kit", "@freeanima/frontend/ui-kit"],
  ["@freeanima/frontend/app-ui", "@freeanima/frontend/app-ui/lib"],
  ["@freeanima/frontend/portal-sdk", "@freeanima/frontend/portal-sdk"],
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
  "@freeanima/frontend/ui-kit/ui/use-acp-progress-dock":
    "@freeanima/frontend/ui-kit/ui/useAcpProgressDock.ts",
  "@freeanima/frontend/ui-kit/ui/acp-types": "@freeanima/frontend/ui-kit/ui/acp-dock-types.ts",
  "@freeanima/frontend/ui-kit/ui/acp": "@freeanima/frontend/ui-kit/ui/AcpProgressDock.tsx",
  "@freeanima/frontend/ui-kit/globals.css": "@freeanima/frontend/ui-kit/styles/globals.css",
  "@freeanima/frontend/ui-kit/form": "@freeanima/frontend/ui-kit/form/FormFieldset.tsx",
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
  "@freeanima/kernel/logging/console": "@freeanima/kernel/logging/sinks/console.ts",
  "@freeanima/kernel/logging/file": "@freeanima/kernel/logging/sinks/file.ts",
  "@freeanima/kernel/logging/memory": "@freeanima/kernel/logging/sinks/memory.ts",
  "@freeanima/kernel/logging/null": "@freeanima/kernel/logging/sinks/null.ts",
  "@freeanima/frontend/app-ui/settings": "@freeanima/frontend/app-ui/lib/settings.ts",
  "@freeanima/frontend/app-ui/sentry-test": "@freeanima/frontend/app-ui/lib/sentry-test.ts",
  "@freeanima/frontend/app-ui/bootstrap/sentry":
    "@freeanima/frontend/app-ui/spa/bootstrap/sentry.ts",
  "@freeanima/frontend/app-ui/mount": "@freeanima/frontend/app-ui/spa/mount.tsx",
  "@freeanima/frontend/app-ui/build": "@freeanima/frontend/app-ui/build.ts",
  "@freeanima/app/shell/tauri/companion-settings-api":
    "@freeanima/app/shell/tauri/spa/companion-settings-api.ts",
  "@freeanima/app/shell/tauri/settings-registry":
    "@freeanima/app/shell/tauri/spa/settings-registry.ts",
  "@freeanima/app/shell/web/static-server": "@freeanima/app/shell/web/lib/static-server.ts",
  "@freeanima/features/habitat/protocol/habitat-contract/display-util":
    "@freeanima/features/habitat/protocol/habitat-contract/display-util.ts",
  "@freeanima/features/habitat/protocol/habitat-contract/date-json":
    "@freeanima/features/habitat/protocol/habitat-contract/date-json.ts",
  "@freeanima/shared/habitat-contract/schemas/habitat-schemas":
    "@freeanima/shared/habitat-contract/schemas/habitat-schemas.ts",
  "@freeanima/capabilities/acp/schemas/acp-jsonrpc":
    "@freeanima/capabilities/acp/schemas/acp-jsonrpc.ts",
  "@freeanima/capabilities/llm-openai/stream-tools":
    "@freeanima/capabilities/llm-openai/stream-tools.ts",
  "@freeanima/capabilities/llm-openai/messages": "@freeanima/capabilities/llm-openai/messages.ts",
  "@freeanima/capabilities/llm-openai/usage": "@freeanima/capabilities/llm-openai/usage.ts",
  "@freeanima/frontend/ui-kit/lib/merge-draft-after-save":
    "@freeanima/frontend/ui-kit/lib/merge-draft-after-save.ts",
  "@freeanima/frontend/ui-kit/lib/copy-text": "@freeanima/frontend/ui-kit/lib/copy-text.ts",
  "@freeanima/frontend/ui-kit/lib/utils": "@freeanima/frontend/ui-kit/lib/utils.ts",
  "@freeanima/core/tool/conversation-port": "@freeanima/core/tool/conversation-port.ts",
  "@freeanima/platform/bind-hosts": "@freeanima/platform/bind-hosts.ts",
  "@freeanima/platform/alive": "@freeanima/platform/alive.ts",
  "@freeanima/kernel/random-uuid": "@freeanima/kernel/random-uuid.ts",
  "@freeanima/frontend/portal-sdk/react": "@freeanima/frontend/portal-sdk/react.tsx",
  "@freeanima/features/habitat/build/paraglide-compile":
    "@freeanima/features/habitat/build/paraglide-compile.ts",
  "@freeanima/features/habitat/build/build-utils":
    "@freeanima/features/habitat/build/build-utils.ts",
  "@freeanima/features/chat/ui/spa/styles.css": "@freeanima/features/chat/ui/spa/styles.css",
  "@freeanima/features/habitat/ui/habitat/styles.css":
    "@freeanima/features/habitat/ui/habitat/styles.css",
  "@freeanima/frontend/ui-kit/styles.css": "@freeanima/frontend/ui-kit/styles.css",
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

// package.json / tsconfig / AGENTS.md at repo root
for (const f of ["package.json", "tsconfig.json", "AGENTS.md"]) {
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
