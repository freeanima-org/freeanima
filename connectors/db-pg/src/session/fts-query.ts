/**
 * 将用户查询转为 PostgreSQL to_tsquery('simple', …) 参数字符串。
 *
 * 默认策略：空格分隔的词用 OR（|）连接（宽召回，对齐原 SQLite FTS5 buildFtsQuery）。
 * 显式 AND/OR/NOT 操作符时保持原样（调用方主动使用复杂查询）。
 */
export function buildPgTsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const operators = new Set(["AND", "OR", "NOT"]);
  if ([...operators].some((op) => trimmed.includes(` ${op} `))) {
    return toTsqueryOperators(trimmed);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return phraseToTsquery(trimmed.slice(1, -1));
  }

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return trimmed;

  const parts = tokens.map((tok) => tokenToTsqueryPart(tok));
  return parts.join(" | ");
}

function toTsqueryOperators(text: string): string {
  return text
    .split(/\s+/)
    .map((tok) => {
      const upper = tok.toUpperCase();
      if (upper === "AND") return "&";
      if (upper === "OR") return "|";
      if (upper === "NOT") return "!";
      return tokenToTsqueryPart(tok);
    })
    .join(" ");
}

function tokenToTsqueryPart(tok: string): string {
  if (tok.startsWith('"') && tok.endsWith('"')) {
    return phraseToTsquery(tok.slice(1, -1));
  }
  if (hasCjk(tok)) {
    return phraseToTsquery(tok);
  }
  const cleaned = tok.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "");
  if (!cleaned) return "";
  return escapeTsToken(cleaned);
}

/** CJK 短语：每字 OR，接近 unicode61 宽召回 */
function phraseToTsquery(text: string): string {
  const chars = [...text].filter((ch) => ch.trim());
  if (!chars.length) return "";
  if (chars.length === 1) return escapeTsToken(chars[0]!);
  return chars.map((ch) => escapeTsToken(ch)).join(" | ");
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
