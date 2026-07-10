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
  ["@/", "@freeanima/satellites/companion/spa/"],
  ["@chat/", "@freeanima/features/chat/ui/spa/"],
  ["@console/", "@freeanima/features/console/ui/console/"],
  ["@shared/", "@freeanima/satellites/companion/shared/"],
  ["@task/", "@freeanima/features/task/ui/spa/"],
  // capabilities 复合名（先于 capabilities- 单段）
  ["@freeanima/capabilities-tools/", "@freeanima/capabilities/tools/"],
  ["@freeanima/capabilities-satellite/", "@freeanima/capabilities/satellite/"],
  ["@freeanima/capabilities-llm-openai/", "@freeanima/capabilities/llm-openai/"],
  ["@freeanima/capabilities-mcp-client/", "@freeanima/capabilities/mcp-client/"],
  ["@freeanima/capabilities-mcp-server/", "@freeanima/capabilities/mcp-server/"],
  ["@freeanima/capabilities-memory/", "@freeanima/capabilities/memory/"],
  ["@freeanima/capabilities-acp/", "@freeanima/capabilities/acp/"],
  // feature / app / shared 逻辑包
  ["@freeanima/feature-", "@freeanima/features/"],
  ["@freeanima/satellite-companion/", "@freeanima/satellites/companion/"],
  ["@freeanima/app-desktop/", "@freeanima/app/shell/desktop/"],
  ["@freeanima/app-mobile/", "@freeanima/app/shell/mobile/"],
  ["@freeanima/app-web/", "@freeanima/app/shell/web/"],
  ["@freeanima/console-api/", "@freeanima/features/console/hub/console-api/"],
  ["@freeanima/console-contract/", "@freeanima/features/console/protocol/console-contract/"],
  ["@freeanima/ui-kit/", "@freeanima/frontend/ui-kit/"],
  ["@freeanima/shell-ui/", "@freeanima/frontend/shell-ui/"],
  ["@freeanima/shell-sdk/", "@freeanima/frontend/shell-sdk/"],
  ["@freeanima/platform/commands/", "@freeanima/platform/slash-commands/"],
  ["@freeanima/admin-api/", "@freeanima/features/console/hub/console-api/"],
  ["@freeanima/admin-contract/", "@freeanima/features/console/protocol/console-contract/"],
  ["@freeanima/hub-contract/", "@freeanima/shared/hub-contract/"],
  ["@freeanima/hub-client/", "@freeanima/shared/hub-client/"],
  ["@freeanima/hub-rpc/", "@freeanima/shared/hub-rpc/"],
  ["@freeanima/vault-crypto/", "@freeanima/shared/vault-crypto/"],
  // bare imports（精确匹配，无尾斜杠）
  ["@freeanima/capabilities-tools", "@freeanima/capabilities/tools"],
  ["@freeanima/capabilities-satellite", "@freeanima/capabilities/satellite"],
  ["@freeanima/capabilities-llm-openai", "@freeanima/capabilities/llm-openai"],
  ["@freeanima/capabilities-mcp-client", "@freeanima/capabilities/mcp-client"],
  ["@freeanima/capabilities-mcp-server", "@freeanima/capabilities/mcp-server"],
  ["@freeanima/capabilities-memory", "@freeanima/capabilities/memory"],
  ["@freeanima/capabilities-acp", "@freeanima/capabilities/acp"],
  ["@freeanima/capabilities-identity", "@freeanima/capabilities/identity"],
  ["@freeanima/satellite-companion", "@freeanima/satellites/companion/lib"],
  ["@freeanima/console-api", "@freeanima/features/console/hub/console-api"],
  ["@freeanima/console-contract", "@freeanima/features/console/protocol/console-contract"],
  ["@freeanima/ui-kit", "@freeanima/frontend/ui-kit"],
  ["@freeanima/shell-ui", "@freeanima/frontend/shell-ui/lib"],
  ["@freeanima/shell-sdk", "@freeanima/frontend/shell-sdk"],
  ["@freeanima/admin-api", "@freeanima/features/console/hub/console-api"],
  ["@freeanima/admin-contract", "@freeanima/features/console/protocol/console-contract"],
  ["@freeanima/hub-contract", "@freeanima/shared/hub-contract"],
  ["@freeanima/hub-client", "@freeanima/shared/hub-client"],
  ["@freeanima/hub-rpc", "@freeanima/shared/hub-rpc"],
  ["@freeanima/vault-crypto", "@freeanima/shared/vault-crypto"],
  ["@freeanima/feature-diary", "@freeanima/features/diary/domain"],
  ["@freeanima/feature-dream", "@freeanima/features/dream/domain"],
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
  "@freeanima/satellites/companion/settings-section":
    "@freeanima/satellites/companion/spa/settings/companion-settings-section.ts",
  "@freeanima/satellites/companion/settings-panel":
    "@freeanima/satellites/companion/spa/settings/CompanionSettingsSection.tsx",
  "@freeanima/satellites/companion/settings-api":
    "@freeanima/satellites/companion/spa/settings/companion-settings-api.ts",
  "@freeanima/satellites/companion/manifest":
    "@freeanima/satellites/companion/lib/exports/manifest.ts",
  "@freeanima/satellites/companion/desktop":
    "@freeanima/satellites/companion/lib/exports/desktop.ts",
  "@freeanima/satellites/companion/mobile": "@freeanima/satellites/companion/lib/exports/mobile.ts",
  "@freeanima/satellites/companion/build": "@freeanima/satellites/companion/lib/exports/build.ts",
  "@freeanima/features/console/ui/console/i18n":
    "@freeanima/features/console/ui/console/lib/i18n.ts",
  "@freeanima/features/console/ui/console/router":
    "@freeanima/features/console/ui/console/router.tsx",
  "@freeanima/platform/commands/vault-cli": "@freeanima/platform/slash-commands/vault-cli.ts",
  "@freeanima/kernel/logging/console": "@freeanima/kernel/logging/sinks/console.ts",
  "@freeanima/kernel/logging/file": "@freeanima/kernel/logging/sinks/file.ts",
  "@freeanima/kernel/logging/memory": "@freeanima/kernel/logging/sinks/memory.ts",
  "@freeanima/kernel/logging/null": "@freeanima/kernel/logging/sinks/null.ts",
  "@freeanima/frontend/shell-ui/settings": "@freeanima/frontend/shell-ui/lib/settings.ts",
  "@freeanima/frontend/shell-ui/sentry-test": "@freeanima/frontend/shell-ui/lib/sentry-test.ts",
  "@freeanima/frontend/shell-ui/bootstrap/sentry":
    "@freeanima/frontend/shell-ui/spa/bootstrap/sentry.ts",
  "@freeanima/frontend/shell-ui/mount": "@freeanima/frontend/shell-ui/spa/mount.tsx",
  "@freeanima/frontend/shell-ui/build": "@freeanima/frontend/shell-ui/build.ts",
  "@freeanima/app/shell/desktop/companion-settings-api":
    "@freeanima/app/shell/desktop/spa/companion-settings-api.ts",
  "@freeanima/app/shell/desktop/settings-registry":
    "@freeanima/app/shell/desktop/spa/settings-registry.ts",
  "@freeanima/app/shell/desktop/settings-stores":
    "@freeanima/app/shell/desktop/lib/settings-stores.ts",
  "@freeanima/app/shell/mobile/settings-registry":
    "@freeanima/app/shell/mobile/lib/settings-registry.ts",
  "@freeanima/app/shell/mobile/settings-stores":
    "@freeanima/app/shell/mobile/lib/settings-stores.ts",
  "@freeanima/app/shell/mobile/capacitor-ready":
    "@freeanima/app/shell/mobile/lib/capacitor-ready.ts",
  "@freeanima/app/shell/mobile/native-build-meta-prefs":
    "@freeanima/app/shell/mobile/lib/native-build-meta-prefs.ts",
  "@freeanima/app/shell/mobile/mobile-shell": "@freeanima/app/shell/mobile/lib/mobile-shell.ts",
  "@freeanima/app/shell/web/static-server": "@freeanima/app/shell/web/lib/static-server.ts",
  "@freeanima/features/console/hub/console-api/console-hub-handlers":
    "@freeanima/features/console/hub/console-api/console-hub-handlers.ts",
  "@freeanima/features/console/protocol/console-contract/display-util":
    "@freeanima/features/console/protocol/console-contract/display-util.ts",
  "@freeanima/features/console/protocol/console-contract/date-json":
    "@freeanima/features/console/protocol/console-contract/date-json.ts",
  "@freeanima/shared/hub-contract/schemas/console-schemas":
    "@freeanima/shared/hub-contract/schemas/console-schemas.ts",
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
  "@freeanima/frontend/shell-sdk/react": "@freeanima/frontend/shell-sdk/react.tsx",
  "@freeanima/features/console/build/paraglide-compile":
    "@freeanima/features/console/build/paraglide-compile.ts",
  "@freeanima/features/console/build/build-utils":
    "@freeanima/features/console/build/build-utils.ts",
  "@freeanima/features/chat/ui/spa/styles.css": "@freeanima/features/chat/ui/spa/styles.css",
  "@freeanima/features/console/ui/console/styles.css":
    "@freeanima/features/console/ui/console/styles.css",
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
