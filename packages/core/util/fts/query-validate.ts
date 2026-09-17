import { FtsQueryError } from "./query-error.ts";
import { isFtsOperatorToken, tokenizeFtsQuery } from "./query-operators.ts";

export function validateFtsQueryInput(raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new FtsQueryError("empty_query", "query 不能为空", "请提供至少一个检索词");
  }

  let quoteCount = 0;
  for (const ch of trimmed) {
    if (ch === '"') quoteCount += 1;
  }
  if (quoteCount % 2 !== 0) {
    throw new FtsQueryError(
      "unclosed_quote",
      "引号未闭合",
      '短语请用成对双引号，例如 "Free Anima" 或 "注意力"',
    );
  }

  const tokens = tokenizeFtsQuery(trimmed);
  if (tokens.length === 0) {
    throw new FtsQueryError("empty_query", "query 不能为空", "请提供至少一个检索词");
  }

  const first = tokens[0];
  if (first === undefined) {
    throw new FtsQueryError("empty_query", "query 不能为空", "请提供至少一个检索词");
  }
  const firstUpper = first.toUpperCase();
  if (firstUpper === "OR" || firstUpper === "AND") {
    throw new FtsQueryError(
      "leading_operator",
      `query 不能以 ${firstUpper} 开头`,
      "示例：退烧 OR 注意力",
    );
  }

  const last = tokens.at(-1);
  if (last === undefined) {
    throw new FtsQueryError("empty_query", "query 不能为空", "请提供至少一个检索词");
  }
  const lastUpper = last.toUpperCase();
  if (isFtsOperatorToken(lastUpper)) {
    throw new FtsQueryError(
      "trailing_operator",
      `query 不能以 ${lastUpper} 结尾`,
      "示例：退烧 OR 注意力",
    );
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];
    if (current === undefined || next === undefined) continue;
    if (isFtsOperatorToken(current) && isFtsOperatorToken(next)) {
      throw new FtsQueryError(
        "consecutive_operators",
        "连续的 AND/OR/NOT 无效",
        "每个 operator 之间需要有检索词，示例：退烧 OR 注意力",
      );
    }
  }

  if (/\s(or|and)\s/i.test(trimmed) && !/\s(OR|AND|NOT)\s/.test(trimmed)) {
    throw new FtsQueryError(
      "invalid_tsquery_structure",
      "布尔运算符请使用大写 OR / AND / NOT",
      "示例：preference OR concise；小写 or/and 会被当作普通检索词",
    );
  }
}

export function assertValidTsQueryString(tsquery: string): void {
  const trimmed = tsquery.trim();
  if (!trimmed) return;

  if (/\)\s+\(/.test(trimmed)) {
    throw new FtsQueryError(
      "invalid_tsquery_structure",
      "检索词之间缺少 AND/OR 连接",
      "空格默认 OR；显式运算符组内多词如 方向 摇摆 仍表示 AND（同时包含）",
    );
  }

  if (/^(?:&|\||!)(?:\s|$)/.test(trimmed) || /(?:^|\s)(?:&|\||!)$/.test(trimmed)) {
    throw new FtsQueryError(
      "invalid_tsquery_structure",
      "生成的 tsquery 结构无效",
      "检查 query 是否以 AND/OR/NOT 开头或结尾，或存在连续 operator",
    );
  }

  if (/(?:&|\||!)\s+(?:&|\||!)/.test(trimmed)) {
    throw new FtsQueryError(
      "invalid_tsquery_structure",
      "生成的 tsquery 存在连续 operator",
      "每个 AND/OR/NOT 之间需要有检索词，示例：退烧 OR 注意力",
    );
  }
}
