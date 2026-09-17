/**
 * `@freeanima/*` import 说明符迁移表（大重构分阶段扩展）。
 *
 * SSOT 供 `scripts/codemod-freeanima-imports.ts`（CLI）与单测共用。
 */

/** 前缀替换表；较长的 from 必须先于其前缀出现。 */
export const REWRITES: readonly [string, string][] = [
  // ── P2：kernel 提包；loop-mechanism 归 engine ────────────────────
  ["@freeanima/habitat/kernel/loop-mechanism", "@freeanima/habitat/engine/loop-mechanism"],
  ["@freeanima/habitat/kernel", "@freeanima/kernel"],
  // ── P0：deprecated 形状垫片 → pg-shapes SSOT ─────────────────────
  [
    "@freeanima/shared/entity-shapes/component-ids",
    "@freeanima/shared/pg-shapes/entity/component-ids",
  ],
  [
    "@freeanima/shared/entity-shapes/pomodoro-active",
    "@freeanima/shared/pg-shapes/entity/pomodoro-active",
  ],
  ["@freeanima/shared/entity-shapes/task-delete", "@freeanima/shared/pg-shapes/entity/task-delete"],
  [
    "@freeanima/shared/entity-shapes/task-recurrence",
    "@freeanima/shared/pg-shapes/entity/task-recurrence",
  ],
  ["@freeanima/shared/entity-shapes", "@freeanima/shared/pg-shapes/entity"],
  ["@freeanima/shared/db-shapes/clarify-item", "@freeanima/shared/pg-shapes/jsonb/clarify-item"],
  ["@freeanima/shared/db-shapes/limbic", "@freeanima/shared/pg-shapes/entity/limbic"],
  ["@freeanima/shared/db-shapes/narrative", "@freeanima/shared/pg-shapes/entity/narrative"],
  ["@freeanima/shared/db-shapes/rows", "@freeanima/shared/pg-shapes/rows/memory-rows"],
  [
    "@freeanima/shared/db-shapes/semantic-memory",
    "@freeanima/shared/pg-shapes/entity/semantic-memory",
  ],
  ["@freeanima/shared/db-shapes", "@freeanima/shared/pg-shapes"],
  // ── P0：engine/loop 垫片 → kernel/loop-mechanism（P2 再迁 engine） ─
  ["@freeanima/habitat/engine/loop", "@freeanima/habitat/engine/loop-mechanism"],
];

/** 本阶段之后不得再出现在 import 说明符里的前缀。 */
export const RETIRED_PREFIXES: readonly string[] = [
  "@freeanima/host/",
  "@freeanima/frontend/",
  "@freeanima/runtime/",
  "@freeanima/core/",
  "@freeanima/platform/",
  "@freeanima/capabilities/",
  "@freeanima/capabilities-",
  "@freeanima/satellites/",
  "@freeanima/process-context",
  "@freeanima/feature-",
  "@freeanima/admin-api",
  "@freeanima/admin-contract",
  "@freeanima/habitat-api",
  "@freeanima/habitat-contract",
  "@freeanima/vault-crypto",
  "@freeanima/shared/db-shapes",
  "@freeanima/shared/entity-shapes",
  "@freeanima/habitat/kernel",
];

/** 匹配静态/动态 import 与 export-from 的字符串说明符。 */
export const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*)(["'])([^"'\n]+)\2/g;

/** ── P1：feature method-defs 上提到契约层 ───────────────────────── */
const METHOD_DEFS_RE = /^@freeanima\/features\/([a-z-]+)\/habitat\/method-defs\.ts$/;
/** P0 删掉的 engine/loop 垫片（精确匹配，避免误伤 engine/loop-mechanism）。 */
const ENGINE_LOOP_SHIM_RE = /^@freeanima\/habitat\/engine\/loop$/;

/** 正则形式的退役模式（无法用固定前缀表达）。 */
export const RETIRED_PATTERNS: readonly RegExp[] = [METHOD_DEFS_RE, ENGINE_LOOP_SHIM_RE];

/** 命中替换表则返回新说明符，否则 null。 */
export function rewriteSpecifier(spec: string): string | null {
  const methodDefs = METHOD_DEFS_RE.exec(spec);
  if (methodDefs?.[1]) {
    return `@freeanima/shared/rpc-contract/feature-rpc/methods/${methodDefs[1]}.ts`;
  }
  for (const [from, to] of REWRITES) {
    if (spec === from) return to;
    if (spec.startsWith(`${from}/`)) return `${to}${spec.slice(from.length)}`;
  }
  return null;
}

/** 命中已退役前缀/模式则返回标签，否则 null。 */
export function retiredBy(spec: string): string | null {
  for (const pattern of RETIRED_PATTERNS) {
    if (pattern.test(spec)) return pattern.source;
  }
  for (const prefix of RETIRED_PREFIXES) {
    if (spec === prefix || spec.startsWith(prefix)) return prefix;
  }
  return null;
}

export type RewriteOutcome = {
  next: string;
  pending: string[];
  retired: string[];
};

/** 重写一段源码；返回新文本与待处理/退役说明符清单。 */
export function rewriteSource(text: string): RewriteOutcome {
  const pending: string[] = [];
  const retired: string[] = [];
  const next = text.replace(
    SPECIFIER_RE,
    (match: string, lead: string, quote: string, spec: string): string => {
      const bad = retiredBy(spec);
      const target = rewriteSpecifier(spec);
      if (bad && !target) retired.push(spec);
      if (!target) return match;
      pending.push(`${spec} → ${target}`);
      return `${lead}${quote}${target}${quote}`;
    },
  );
  return { next, pending, retired };
}
