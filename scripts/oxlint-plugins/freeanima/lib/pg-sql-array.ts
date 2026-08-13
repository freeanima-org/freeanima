/**
 * Bun SQL text[] 绑定护栏纯函数（原 scripts/check-pg-sql-arrays.ts）。
 * 禁止 ANY / ?| / ?& / && 裸绑 JS 数组；须 pgTextArray(...) 或 ARRAY[…]::text[]。
 */

export type PgSqlArrayHit = {
  /** 0-based index into the scanned text */
  index: number;
  expr: string;
  snippet: string;
};

/** sql`…` / drizzleSql`…` 模板（非嵌套扫描；够用） */
const SQL_TEMPLATE_RE = /(?:sql|drizzleSql)`((?:[^`\\]|\\.)*)`/gs;

/**
 * array 消费算子 + ${expr}。
 * 允许：pgTextArray(...)、内含 ARRAY[ 的展开（含嵌套 sql`ARRAY[…]`）。
 */
const ARRAY_OP_BIND_RE = /(?:(?:^|[^$\w])ANY\s*\(|\?[|&]|\s&&\s)\s*\$\{([^}]+)\}/g;

export function isSafePgArrayBinding(expr: string): boolean {
  const t = expr.replace(/\s+/g, " ").trim();
  if (/\bpgTextArray\s*\(/.test(t)) return true;
  if (/ARRAY\s*\[/.test(t)) return true;
  return false;
}

/** 扫描整段源码中的 sql/drizzleSql 模板违规绑定。 */
export function findPgSqlArrayHits(text: string): PgSqlArrayHit[] {
  const hits: PgSqlArrayHit[] = [];
  for (const tm of text.matchAll(SQL_TEMPLATE_RE)) {
    const body = tm[1] ?? "";
    const bodyOffset = (tm.index ?? 0) + (tm[0]?.indexOf("`") ?? 0) + 1;
    for (const bm of body.matchAll(ARRAY_OP_BIND_RE)) {
      const expr = (bm[1] ?? "").trim();
      if (!expr || isSafePgArrayBinding(expr)) continue;
      hits.push({
        index: bodyOffset + (bm.index ?? 0),
        expr,
        snippet: body.replace(/\s+/g, " ").trim().slice(0, 120),
      });
    }
  }
  return hits;
}

/** 扫描单个模板字面量 body（不含外层反引号）。 */
export function findPgSqlArrayHitsInTemplateBody(body: string): PgSqlArrayHit[] {
  const hits: PgSqlArrayHit[] = [];
  for (const bm of body.matchAll(ARRAY_OP_BIND_RE)) {
    const expr = (bm[1] ?? "").trim();
    if (!expr || isSafePgArrayBinding(expr)) continue;
    hits.push({
      index: bm.index ?? 0,
      expr,
      snippet: body.replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }
  return hits;
}
