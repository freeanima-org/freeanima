import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import {
  CONTENT_BLOCK_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  entities,
  DIARY_ENTRY_COMPONENT,
  MILESTONE_COMPONENT,
  PROJECT_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  parseContentBlockSearchFilters,
  parseDiaryEntrySearchFilters,
  parseEmailAccountSearchFilters,
  parseEmailMessageSearchFilters,
  parseEmailThreadSearchFilters,
  parseMilestoneSearchFilters,
  parsePomodoroSessionSearchFilters,
  parsePomodoroTaskFocusSearchFilters,
  parseProjectFolderSearchFilters,
  parseProjectSearchFilters,
  parseTagSearchFilters,
  parseTaskItemSearchFilters,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  TAG_COMPONENT,
  parseTaskListSearchFilters,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  type EntityType,
} from "@freeanima/core/db/schema";
import { pgBigintArray } from "../../utils/pg-sql.ts";
import type { EntitySearchOpts } from "../types.ts";

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
      return [eq(entities.world_id, ids[0] as number)];
    }
    return [inArray(entities.world_id, ids)];
  }

  if (opts.world_id == null || opts.world_id <= 0) {
    throw new EntitySearchScopeError(
      "entity_search_scope_required",
      "world_id is required unless global=true",
    );
  }
  return [eq(entities.world_id, opts.world_id)];
}

const CST_TODAY = sql`(now() AT TIME ZONE 'Asia/Shanghai')::date`;

function buildTaskItemDueOnCondition(relativeDay: "today" | "tomorrow" | "yesterday"): SQL {
  if (relativeDay === "today") {
    return sql`(${entities.body}->>'due_at')::timestamptz::date = ${CST_TODAY}`;
  }
  if (relativeDay === "tomorrow") {
    return sql`(${entities.body}->>'due_at')::timestamptz::date = ${CST_TODAY} + 1`;
  }
  return sql`(${entities.body}->>'due_at')::timestamptz::date = ${CST_TODAY} - 1`;
}

function buildTaskItemCompletedOnCondition(relativeDay: "today" | "tomorrow" | "yesterday"): SQL {
  if (relativeDay === "today") {
    return sql`(${entities.body}->>'completed_at')::timestamptz::date = ${CST_TODAY}`;
  }
  if (relativeDay === "tomorrow") {
    return sql`(${entities.body}->>'completed_at')::timestamptz::date = ${CST_TODAY} + 1`;
  }
  return sql`(${entities.body}->>'completed_at')::timestamptz::date = ${CST_TODAY} - 1`;
}

function buildPomodoroSessionBodyConditions(
  filters: ReturnType<typeof parsePomodoroSessionSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.started_after) {
    conditions.push(
      sql`(${entities.body}->>'started_at')::timestamptz >= ${filters.started_after}::timestamptz`,
    );
  }
  if (filters.started_before) {
    conditions.push(
      sql`(${entities.body}->>'started_at')::timestamptz <= ${filters.started_before}::timestamptz`,
    );
  }
  if (filters.phase != null) {
    conditions.push(sql`${entities.body}->>'phase' = ${filters.phase}`);
  }
  if (filters.interrupted != null) {
    conditions.push(
      sql`coalesce((${entities.body}->>'interrupted')::boolean, false) = ${filters.interrupted}`,
    );
  }
  if (filters.task_item_id != null) {
    conditions.push(sql`${entities.body}->>'task_item_id' = ${String(filters.task_item_id)}`);
  }
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildPomodoroTaskFocusBodyConditions(
  filters: ReturnType<typeof parsePomodoroTaskFocusSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.task_item_id != null) {
    conditions.push(sql`${entities.body}->>'task_item_id' = ${String(filters.task_item_id)}`);
  }
  if (filters.session_local_id) {
    conditions.push(sql`${entities.body}->>'session_local_id' = ${filters.session_local_id}`);
  }
  if (filters.pomodoro_session_id != null) {
    conditions.push(
      sql`${entities.body}->>'pomodoro_session_id' = ${String(filters.pomodoro_session_id)}`,
    );
  }
  if (filters.phase_started_at) {
    conditions.push(sql`${entities.body}->>'phase_started_at' = ${filters.phase_started_at}`);
  }
  if (filters.started_after) {
    conditions.push(
      sql`(${entities.body}->>'started_at')::timestamptz >= ${filters.started_after}::timestamptz`,
    );
  }
  if (filters.started_before) {
    conditions.push(
      sql`(${entities.body}->>'started_at')::timestamptz <= ${filters.started_before}::timestamptz`,
    );
  }
  return conditions;
}

function buildTaskItemBodyConditions(
  filters: ReturnType<typeof parseTaskItemSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.list_ids != null && filters.list_ids.length > 0) {
    if (filters.list_ids.length === 1) {
      conditions.push(sql`${entities.body}->>'list_id' = ${String(filters.list_ids[0])}`);
    } else {
      conditions.push(
        sql`${entities.body}->>'list_id' IN (${sql.join(
          filters.list_ids.map((id) => sql`${String(id)}`),
          sql`, `,
        )})`,
      );
    }
  } else if (filters.list_id != null) {
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
  if (filters.tag_ids?.length) {
    conditions.push(sql`${entities.tag_ids} @> ${pgBigintArray(filters.tag_ids)}`);
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
  if (filters.has_due_at) {
    conditions.push(
      sql`${entities.body}->>'due_at' IS NOT NULL AND ${entities.body}->>'due_at' <> ''`,
    );
  }
  if (filters.due_on != null) {
    conditions.push(buildTaskItemDueOnCondition(filters.due_on));
  }
  if (filters.due_on_or_before_days != null) {
    conditions.push(
      sql`(${entities.body}->>'due_at')::timestamptz IS NOT NULL
        AND (${entities.body}->>'due_at')::timestamptz::date <= ${CST_TODAY} + ${filters.due_on_or_before_days}`,
    );
  }
  if (filters.completed_on != null) {
    conditions.push(buildTaskItemCompletedOnCondition(filters.completed_on));
  }
  if (filters.completed_on_or_after_days != null) {
    conditions.push(
      sql`(${entities.body}->>'completed_at')::timestamptz IS NOT NULL
        AND (${entities.body}->>'completed_at')::timestamptz::date >= ${CST_TODAY} - ${filters.completed_on_or_after_days}`,
    );
  }
  if (filters.project_id != null) {
    conditions.push(sql`${entities.body}->>'project_id' = ${String(filters.project_id)}`);
  }
  if (filters.in_backlog === true) {
    conditions.push(
      sql`(${entities.body}->>'project_id' IS NULL OR ${entities.body}->>'project_id' = '')`,
    );
  }
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildTaskListBodyConditions(
  filters: ReturnType<typeof parseTaskListSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildProjectFolderBodyConditions(
  filters: ReturnType<typeof parseProjectFolderSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildProjectBodyConditions(filters: ReturnType<typeof parseProjectSearchFilters>): SQL[] {
  const conditions: SQL[] = [];
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildMilestoneBodyConditions(
  filters: ReturnType<typeof parseMilestoneSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildTagBodyConditions(filters: ReturnType<typeof parseTagSearchFilters>): SQL[] {
  const conditions: SQL[] = [];
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildDiaryEntryBodyConditions(
  filters: ReturnType<typeof parseDiaryEntrySearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      conditions.push(sql`${entities.body}->'tags' ? ${tag}`);
    }
  }
  if (filters.entry_after) {
    conditions.push(
      sql`(${entities.body}->>'entry_at')::timestamptz >= ${filters.entry_after}::timestamptz`,
    );
  }
  if (filters.entry_before) {
    conditions.push(
      sql`(${entities.body}->>'entry_at')::timestamptz <= ${filters.entry_before}::timestamptz`,
    );
  }
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildContentBlockBodyConditions(
  filters: ReturnType<typeof parseContentBlockSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.parent_id != null) {
    conditions.push(sql`${entities.body}->>'parent_id' = ${String(filters.parent_id)}`);
  }
  if (filters.block_type) {
    conditions.push(sql`${entities.body}->>'block_type' = ${filters.block_type}`);
  }
  if (filters.client_op_id) {
    conditions.push(sql`${entities.body}->>'client_op_id' = ${filters.client_op_id}`);
  }
  return conditions;
}

function buildEmailAccountBodyConditions(
  filters: ReturnType<typeof parseEmailAccountSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.enabled != null) {
    conditions.push(
      sql`coalesce((${entities.body}->>'enabled')::boolean, true) = ${filters.enabled}`,
    );
  }
  if (filters.default_sender != null) {
    conditions.push(
      sql`coalesce((${entities.body}->>'default_sender')::boolean, false) = ${filters.default_sender}`,
    );
  }
  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      conditions.push(sql`${entities.body}->'tags' ? ${tag}`);
    }
  }
  return conditions;
}

function buildEmailThreadBodyConditions(
  filters: ReturnType<typeof parseEmailThreadSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.account_id != null) {
    conditions.push(sql`${entities.body}->>'account_id' = ${String(filters.account_id)}`);
  }
  if (filters.thread_key) {
    conditions.push(sql`${entities.body}->>'thread_key' = ${filters.thread_key}`);
  }
  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      conditions.push(sql`${entities.body}->'tags' ? ${tag}`);
    }
  }
  if (filters.has_unread) {
    conditions.push(sql`coalesce((${entities.body}->>'unread_count')::int, 0) > 0`);
  }
  return conditions;
}

function buildEmailMessageBodyConditions(
  filters: ReturnType<typeof parseEmailMessageSearchFilters>,
): SQL[] {
  const conditions: SQL[] = [];
  if (filters.account_id != null) {
    conditions.push(sql`${entities.body}->>'account_id' = ${String(filters.account_id)}`);
  }
  if (filters.thread_id != null) {
    conditions.push(sql`${entities.body}->>'thread_id' = ${String(filters.thread_id)}`);
  }
  if (filters.imap_uid != null) {
    conditions.push(sql`${entities.body}->>'imap_uid' = ${String(filters.imap_uid)}`);
  }
  if (filters.imap_mailbox) {
    conditions.push(sql`${entities.body}->>'imap_mailbox' = ${filters.imap_mailbox}`);
  }
  if (filters.unread != null) {
    conditions.push(
      sql`coalesce((${entities.body}->>'unread')::boolean, false) = ${filters.unread}`,
    );
  }
  if (filters.direction != null) {
    conditions.push(sql`${entities.body}->>'direction' = ${filters.direction}`);
  }
  if (filters.tags?.length) {
    for (const tag of filters.tags) {
      conditions.push(sql`${entities.body}->'tags' ? ${tag}`);
    }
  }
  if (filters.since) {
    conditions.push(
      sql`(${entities.body}->>'sent_at')::timestamptz >= ${filters.since}::timestamptz`,
    );
  }
  if (filters.before) {
    conditions.push(
      sql`(${entities.body}->>'sent_at')::timestamptz <= ${filters.before}::timestamptz`,
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
  if (component === TASK_LIST_COMPONENT) {
    return buildTaskListBodyConditions(parseTaskListSearchFilters(filters));
  }
  if (component === PROJECT_FOLDER_COMPONENT) {
    return buildProjectFolderBodyConditions(parseProjectFolderSearchFilters(filters));
  }
  if (component === PROJECT_COMPONENT) {
    return buildProjectBodyConditions(parseProjectSearchFilters(filters));
  }
  if (component === MILESTONE_COMPONENT) {
    return buildMilestoneBodyConditions(parseMilestoneSearchFilters(filters));
  }
  if (component === TAG_COMPONENT) {
    return buildTagBodyConditions(parseTagSearchFilters(filters));
  }
  if (component === CONTENT_BLOCK_COMPONENT) {
    return buildContentBlockBodyConditions(parseContentBlockSearchFilters(filters));
  }
  if (component === DIARY_ENTRY_COMPONENT) {
    return buildDiaryEntryBodyConditions(parseDiaryEntrySearchFilters(filters));
  }
  if (component === EMAIL_ACCOUNT_COMPONENT) {
    return buildEmailAccountBodyConditions(parseEmailAccountSearchFilters(filters));
  }
  if (component === EMAIL_THREAD_COMPONENT) {
    return buildEmailThreadBodyConditions(parseEmailThreadSearchFilters(filters));
  }
  if (component === EMAIL_MESSAGE_COMPONENT) {
    return buildEmailMessageBodyConditions(parseEmailMessageSearchFilters(filters));
  }
  if (component === POMODORO_SESSION_COMPONENT) {
    return buildPomodoroSessionBodyConditions(parsePomodoroSessionSearchFilters(filters));
  }
  if (component === POMODORO_TASK_FOCUS_COMPONENT) {
    return buildPomodoroTaskFocusBodyConditions(parsePomodoroTaskFocusSearchFilters(filters));
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
    conditions.push(eq(entities.primary_component, opts.primary_component));
  }
  if (opts.component) {
    conditions.push(sql`${entities.components} @> ARRAY[${opts.component}]::text[]`);
  }
  if (opts.created_after) {
    conditions.push(gte(entities.created_at, new Date(opts.created_after)));
  }
  if (opts.created_before) {
    conditions.push(lte(entities.created_at, new Date(opts.created_before)));
  }
  if (opts.updated_after) {
    conditions.push(gte(entities.updated_at, new Date(opts.updated_after)));
  }
  if (opts.updated_before) {
    conditions.push(lte(entities.updated_at, new Date(opts.updated_before)));
  }
  if (opts.tag_ids?.length) {
    conditions.push(sql`${entities.tag_ids} @> ${pgBigintArray(opts.tag_ids)}`);
  }

  conditions.push(...buildComponentFilterConditions(opts));
  return conditions;
}

export function buildEntitySearchWhere(opts: EntitySearchOpts): SQL | undefined {
  const conditions = buildEntitySearchConditions(opts);
  return conditions.length > 0 ? and(...conditions) : undefined;
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
