/**
 * 已退役的 `@freeanima/*` import 说明符清单。
 *
 * 大重构（13 包拆分）的机械改写已在 P0–P7 完成，本表只作**禁令**校验：
 * SSOT 供 `scripts/check-retired-imports.ts`（`just qa check`）与单测共用。
 */

/**
 * 不得再出现的说明符前缀（`spec === prefix` 或其子路径）。
 *
 * 注意：目标包名（kernel/core/engine/capabilities/features/server/cli/
 * shared/ui-kit/portal-sdk/ui-features/app-frame/portal）不在此列。
 */
export const RETIRED_PREFIXES: readonly string[] = [
  "@freeanima/host/",
  "@freeanima/frontend/",
  "@freeanima/runtime/",
  "@freeanima/habitat/",
  "@freeanima/platform/",
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
];

/** 正则形式的退役模式（无法用固定前缀表达）。 */
export const RETIRED_PATTERNS: readonly RegExp[] = [
  /** P1：feature method-defs 上提到契约层 */
  /^@freeanima\/features\/[a-z-]+\/habitat\/method-defs\.ts$/,
  /** P0：engine/loop 垫片（精确匹配，避免误伤 engine/loop-mechanism） */
  /^@freeanima\/engine\/loop$/,
  /** P2：kernel 提包后 loop-mechanism 归 engine */
  /^@freeanima\/kernel\/loop-mechanism$/,
];

/** 匹配静态/动态 import 与 export-from 的字符串说明符。 */
export const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*)(["'])([^"'\n]+)\2/g;

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

/** 扫描一段源码，返回命中的退役说明符（去重，保持出现顺序）。 */
export function scanRetiredSpecifiers(text: string): string[] {
  const retired: string[] = [];
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const spec = match[3];
    if (!spec || !retiredBy(spec)) continue;
    if (!retired.includes(spec)) retired.push(spec);
  }
  return retired;
}
