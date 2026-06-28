import {
  buildOperatorTsQuery,
  hasFtsQueryOperators,
  parseFtsOperatorQuery,
} from "@freeanima/core/util";

/**
 * Convert user query to PostgreSQL to_tsquery('simple', …) param string (per-char/word mode).
 */
export function buildCharModeTsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (hasFtsQueryOperators(trimmed)) {
    return buildOperatorTsQuery(parseFtsOperatorQuery(trimmed), tokenToTsqueryPart);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return wrapTsqueryPart(cjkProximityChain(trimmed.slice(1, -1)));
  }

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return trimmed;

  const parts = tokens.map((tok) => tokenToTsqueryPart(tok)).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return parts.map(wrapTsqueryPart).join(" & ");
}

/** jieba token string: whole-word AND match */
export function buildJiebaModeTsQuery(segmented: string): string {
  const tokens = segmented
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, ""))
    .filter(Boolean);
  if (!tokens.length) return "";
  if (tokens.length === 1) return escapeTsToken(tokens[0]!);
  return tokens.map((t) => escapeTsToken(t)).join(" & ");
}

/** jieba operator query: segment each operand group, then join with boolean ops */
export function buildJiebaGroupTsQuery(segmented: string): string {
  const part = buildJiebaModeTsQuery(segmented);
  if (!part) return "";
  if (part.includes(" & ")) return `(${part})`;
  return part;
}

function tokenToTsqueryPart(tok: string): string {
  if (tok.startsWith('"') && tok.endsWith('"')) {
    return cjkProximityChain(tok.slice(1, -1));
  }
  if (hasCjk(tok)) {
    return cjkProximityChain(tok);
  }
  const cleaned = tok.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "");
  if (!cleaned) return "";
  return escapeTsToken(cleaned);
}

function cjkProximityChain(text: string): string {
  const chars = [...text].filter((ch) => ch.trim());
  if (!chars.length) return "";
  if (chars.length === 1) return escapeTsToken(chars[0]!);
  return chars.map((ch) => escapeTsToken(ch)).join(" <-> ");
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
