import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import {
  entities,
  parseTaskItemSearchFilters,
  TASK_ITEM_COMPONENT,
  type EntityType,
} from "@freeanima/core/db/schema";
import type { EntitySearchOpts } from "@freeanima/core/repos";

export class EntitySearchScopeError extends Error {
  readonly code: "entity_search_scope_required" | "entity_search_global_forbidden";

  constructor(code: EntitySearchScopeError["code"], message: string) {
    super(message);
    this.name = "EntitySearchScopeError";
    this.code = code;
  }
}

export function resolveWorldScope(opts: EntitySearchOpts): SQL[] {
  if (opts.global) {
    const ids = opts.accessible_world_ids?.filter((id) => Number.isFinite(id) && id > 0) ?? [];
    if (ids.length === 0) {
      throw new EntitySearchScopeError(
        "entity_search_global_forbidden",
        "global search requires accessible_world_ids",
      );
    }
    if (ids.length === 1) {
      return [eq(entities.worldId, ids[0]!)];
    }
    return [inArray(entities.worldId, ids)];
  }

  if (opts.world_id == null || opts.world_id <= 0) {
    throw new EntitySearchScopeError(
      "entity_search_scope_required",
      "world_id is required unless global=true",
    );
  }
  return [eq(entities.worldId, opts.world_id)];
}

function buildTaskItemBodyConditions(
  filters: ReturnType<typeof parseTaskItemSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.list_id != null) {
    conditions.push(sql`${entities.body}->>'list_id' = ${String(filters.list_id)}`);
  }
  if (filters.status != null && filters.status !== "all") {
    conditions.push(sql`${entities.body}->>'status' = ${filters.status}`);
  }
  if (filters.priority != null) {
    conditions.push(sql`${entities.body}->>'priority' = ${filters.priority}`);
  }
  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      conditions.push(sql`${entities.body}->'tags' ? ${tag}`);
    }
  }
  if (filters.due_today) {
    conditions.push(
      sql`(${entities.body}->>'due_at')::timestamptz::date = (now() AT TIME ZONE 'Asia/Shanghai')::date`,
    );
  }
  if (filters.due_before) {
    conditions.push(
      sql`(${entities.body}->>'due_at')::timestamptz <= ${filters.due_before}::timestamptz`,
    );
  }
  if (filters.due_after) {
    conditions.push(
      sql`(${entities.body}->>'due_at')::timestamptz >= ${filters.due_after}::timestamptz`,
    );
  }
  return conditions;
}

export function buildComponentFilterConditions(opts: EntitySearchOpts): SQL[] {
  const filters = opts.filters;
  if (!filters || Object.keys(filters).length === 0) return [];

  const component = opts.primary_component ?? opts.component;
  if (component === TASK_ITEM_COMPONENT) {
    return buildTaskItemBodyConditions(parseTaskItemSearchFilters(filters));
  }

  if (component) {
    throw new Error(`unsupported filters for component: ${component}`);
  }
  throw new Error("filters require primary_component or component");
}

export function buildEntitySearchConditions(opts: EntitySearchOpts): SQL[] {
  const conditions = [...resolveWorldScope(opts)];

  if (opts.type != null) {
    conditions.push(eq(entities.type, opts.type));
  }
  if (opts.types != null && opts.types.length > 0) {
    conditions.push(inArray(entities.type, opts.types as EntityType[]));
  }
  if (opts.primary_component) {
    conditions.push(eq(entities.primaryComponent, opts.primary_component));
  }
  if (opts.component) {
    conditions.push(sql`${entities.components} @> ARRAY[${opts.component}]::text[]`);
  }
  if (opts.created_after) {
    conditions.push(gte(entities.createdAt, opts.created_after));
  }
  if (opts.created_before) {
    conditions.push(lte(entities.createdAt, opts.created_before));
  }
  if (opts.updated_after) {
    conditions.push(gte(entities.updatedAt, opts.updated_after));
  }
  if (opts.updated_before) {
    conditions.push(lte(entities.updatedAt, opts.updated_before));
  }

  conditions.push(...buildComponentFilterConditions(opts));
  return conditions;
}

export function buildEntitySearchWhere(opts: EntitySearchOpts): SQL | undefined {
  const conditions = buildEntitySearchConditions(opts);
  return conditions.length ? and(...conditions) : undefined;
}

/** 去掉全角括号等装饰符，便于 ILIKE / FTS 匹配正文关键词 */
export function normalizeEntitySearchQuery(raw: string): string {
  return raw
    .replace(/[【】[\]()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entitySearchableTextExpr(): SQL {
  return sql`btrim(
    coalesce(${entities.title}, '') || ' ' ||
    coalesce(${entities.summary}, '') || ' ' ||
    coalesce(${entities.content}, '')
  )`;
}

function isCjkChar(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf);
}

function escapePgRegexLiteral(ch: string): string {
  return ch.replace(/[\\.^$*+?{}[\]|()]/g, "\\$&");
}

/**
 * 中文等 CJK 查询：字符按顺序出现即可（允许中间缺字/插字）。
 * 例：「知识片」→ `知.*识.*片`，可命中「知识卡片」。
 */
export function buildCjkOrderedCharRegexPattern(query: string): string | null {
  const chars = [...query.replace(/\s+/g, "")].filter((ch) => {
    if (!ch.trim()) return false;
    return isCjkChar(ch) || /[\w]/.test(ch);
  });
  const cjkCount = chars.filter(isCjkChar).length;
  if (cjkCount < 2) return null;
  return chars.map(escapePgRegexLiteral).join(".*");
}

/** 连续子串 ILIKE */
export function buildTitleIlikeCondition(query: string): SQL {
  const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  return sql`(
    ${entities.title} ILIKE ${pattern} ESCAPE '\\'
    OR ${entities.summary} ILIKE ${pattern} ESCAPE '\\'
    OR ${entities.content} ILIKE ${pattern} ESCAPE '\\'
  )`;
}

/** 子串 + CJK 顺序模糊（filter_only / hybrid 兜底） */
export function buildEntityTextMatchCondition(query: string): SQL {
  const ilike = buildTitleIlikeCondition(query);
  const ordered = buildCjkOrderedCharRegexPattern(query);
  if (!ordered) return ilike;
  const haystack = entitySearchableTextExpr();
  return sql`(${ilike} OR ${haystack} ~ ${ordered})`;
}
