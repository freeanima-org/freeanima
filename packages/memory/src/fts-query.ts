/** 将搜索查询转为 FTS5 MATCH 字符串
 *
 *  默认策略：空格分隔的词用 OR 连接（宽召回）
 *  CJK 词自动转为引号短语（适配 unicode61 按字分词的特性）
 *  调用方可显式使用 AND/OR/NOT/NEAR 覆盖默认行为
 */
export function buildFtsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // 如果包含显式 FTS5 操作符（前后带空格），保持原样——调用方主动使用复杂查询
  const operators = new Set(["AND", "OR", "NOT"]);
  if ([...operators].some((op) => trimmed.includes(` ${op} `))) return trimmed;
  // NEAR 可能带参数如 NEAR/5，单独判断
  if (/\bNEAR\b/i.test(trimmed)) return trimmed;
  // 如果已是引号短语，保持原样
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;

  // 按空白分词
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return trimmed;

  const parts = tokens.map((tok) => {
    if (hasCjk(tok)) {
      // CJK 词用引号包围作为短语查询 —— unicode61 分词器会将每个 CJK 字拆为独立 token，
      // 引号短语匹配连续的 token 序列，效果等价于「包含该词」
      return `"${tok}"`;
    }
    return tok;
  });

  // 默认用 OR 连接（宽召回，宁可多不可漏）
  return parts.join(" OR ");
}

function hasCjk(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) return true;
  }
  return false;
}
