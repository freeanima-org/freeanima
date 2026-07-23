import {
  buildOperatorTsQuery,
  hasFtsQueryOperators,
  parseFtsOperatorQuery,
} from "@freeanima/core/util";

/** Full char proximity only for 1–2 CJK chars; longer unquoted spans use bigram OR. */
export const CJK_PROXIMITY_MAX_CHARS = 2;

/**
 * Convert user query to PostgreSQL to_tsquery('simple', …) param string (per-char/word mode).
 * Space-separated terms default to OR; explicit AND/OR/NOT keep operand-group AND.
 */
export function buildCharModeTsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (hasFtsQueryOperators(trimmed)) {
    return buildOperatorTsQuery(parseFtsOperatorQuery(trimmed), tokenToTsqueryPart);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    // Quoted phrase: keep full adjacency (user asked for exact phrase).
    return wrapTsqueryPart(cjkProximityChain(trimmed.slice(1, -1), { forceFullChain: true }));
  }

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return trimmed;

  const parts = tokens.map((tok) => tokenToTsqueryPart(tok)).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    const sole = parts[0];
    return sole ?? "";
  }
  return parts.map(wrapTsqueryPart).join(" | ");
}

/** jieba token string: whole-word OR match (broader recall for NL queries). */
export function buildJiebaModeTsQuery(segmented: string): string {
  return joinJiebaTokens(segmented, " | ");
}

/** jieba operator operand group: tokens AND (matches char-mode operand groups). */
export function buildJiebaGroupTsQuery(segmented: string): string {
  const part = joinJiebaTokens(segmented, " & ");
  if (!part) return "";
  if (part.includes(" & ") || part.includes(" | ")) return `(${part})`;
  return part;
}

function joinJiebaTokens(segmented: string, joiner: " | " | " & "): string {
  const tokens = segmented
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) {
    const sole = tokens[0];
    return sole === undefined ? "" : escapeTsToken(sole);
  }
  return tokens.map((t) => escapeTsToken(t)).join(joiner);
}

function tokenToTsqueryPart(tok: string): string {
  if (tok.startsWith('"') && tok.endsWith('"')) {
    return cjkProximityChain(tok.slice(1, -1), { forceFullChain: true });
  }
  if (hasCjk(tok)) {
    return cjkProximityChain(tok);
  }
  const cleaned = tok.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "");
  if (!cleaned) return "";
  return escapeTsToken(cleaned);
}

function cjkProximityChain(text: string, opts?: { forceFullChain?: boolean }): string {
  // Drop punctuation / spaces so NL questions like「你的邮箱是啥？」don't require exact spans.
  const chars = [...text].filter((ch) => {
    if (!ch.trim()) return false;
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) return true;
    return /[\w-]/.test(ch);
  });
  if (chars.length === 0) return "";
  if (chars.length === 1) {
    const sole = chars[0];
    return sole === undefined ? "" : escapeTsToken(sole);
  }
  if (!opts?.forceFullChain && chars.length > CJK_PROXIMITY_MAX_CHARS) {
    return cjkBigramOr(chars);
  }
  return chars.map((ch) => escapeTsToken(ch)).join(" <-> ");
}

/** Consecutive bigram proximity ORed — avoids whole-sentence `<->` chains. */
function cjkBigramOr(chars: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i];
    const b = chars[i + 1];
    if (a === undefined || b === undefined) continue;
    parts.push(`(${escapeTsToken(a)} <-> ${escapeTsToken(b)})`);
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    const sole = parts[0];
    return sole ?? "";
  }
  return parts.join(" | ");
}

function wrapTsqueryPart(part: string): string {
  if (!part) return part;
  if (part.includes(" & ") || part.includes(" | ") || part.includes(" <-> ")) {
    return `(${part})`;
  }
  return part;
}

function escapeTsToken(tok: string): string {
  return tok.replace(/[&|!():*'\\]/g, "\\$&");
}

function hasCjk(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) return true;
  }
  return false;
}
