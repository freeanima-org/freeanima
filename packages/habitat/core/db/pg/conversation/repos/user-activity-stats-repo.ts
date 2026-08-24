import { eq, sql } from "drizzle-orm";
import { conversations, messages } from "@freeanima/habitat/core/db/schema";
import { getDb } from "../../client.ts";
import { messagePayloadTimestampSql } from "./message-payload-timestamp.ts";

export type ActivityWindowId =
  | "today"
  | "yesterday"
  | "day_before_yesterday"
  | "last_7d"
  | "last_30d"
  | "last_90d"
  | "last_365d";

export type ActivityWindowBound = {
  id: ActivityWindowId;
  from_iso: string;
  to_iso: string;
};

export type ActivityWindowCounts = {
  created: number;
  updated: number;
  user_messages: number;
};

export type UserActivityStats = Record<ActivityWindowId, ActivityWindowCounts>;

const WINDOW_IDS: ActivityWindowId[] = [
  "today",
  "yesterday",
  "day_before_yesterday",
  "last_7d",
  "last_30d",
  "last_90d",
  "last_365d",
];

const EMPTY: ActivityWindowCounts = { created: 0, updated: 0, user_messages: 0 };

function requireBound(
  map: Map<ActivityWindowId, ActivityWindowBound>,
  id: ActivityWindowId,
): ActivityWindowBound {
  const b = map.get(id);
  if (!b) throw new Error(`missing activity window bound: ${id}`);
  return b;
}

function createdFilter(b: ActivityWindowBound) {
  return sql`${conversations.created_at} >= ${b.from_iso}::timestamptz
    AND ${conversations.created_at} < ${b.to_iso}::timestamptz`;
}

function updatedFilter(b: ActivityWindowBound) {
  return sql`${conversations.updated_at} >= ${b.from_iso}::timestamptz
    AND ${conversations.updated_at} < ${b.to_iso}::timestamptz
    AND ${conversations.created_at} < ${b.from_iso}::timestamptz`;
}

function msgTsFilter(b: ActivityWindowBound) {
  const msgTs = messagePayloadTimestampSql();
  return sql`${msgTs} IS NOT NULL
    AND ${msgTs} >= ${b.from_iso}::timestamptz
    AND ${msgTs} < ${b.to_iso}::timestamptz`;
}

function packWindowCounts(
  created: number | undefined,
  updated: number | undefined,
  user_messages: number | undefined,
): ActivityWindowCounts {
  return {
    created: created ?? 0,
    updated: updated ?? 0,
    user_messages: user_messages ?? 0,
  };
}

/**
 * 按 CST 窗聚合：新开 / 更新（窗内有活动且非本窗新建）/ 用户消息。
 * 排除 debug 与 cron。须传入完整七窗 bounds。
 */
export async function aggregateUserActivityStats(
  bounds: ActivityWindowBound[],
): Promise<UserActivityStats> {
  const map = new Map(bounds.map((b) => [b.id, b]));
  for (const id of WINDOW_IDS) requireBound(map, id);

  const t = requireBound(map, "today");
  const y = requireBound(map, "yesterday");
  const dby = requireBound(map, "day_before_yesterday");
  const d7 = requireBound(map, "last_7d");
  const d30 = requireBound(map, "last_30d");
  const d90 = requireBound(map, "last_90d");
  const d365 = requireBound(map, "last_365d");

  const db = getDb();
  const nonCronDebug = sql`${conversations.debug} = false
    AND COALESCE(${conversations.platform_info}->>'platform', '') <> 'cron'`;

  const convRows = await db
    .select({
      today_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(t)})::int`,
      today_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(t)})::int`,
      yesterday_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(y)})::int`,
      yesterday_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(y)})::int`,
      dby_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(dby)})::int`,
      dby_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(dby)})::int`,
      d7_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(d7)})::int`,
      d7_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(d7)})::int`,
      d30_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(d30)})::int`,
      d30_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(d30)})::int`,
      d90_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(d90)})::int`,
      d90_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(d90)})::int`,
      d365_c: sql<number>`count(*) FILTER (WHERE ${createdFilter(d365)})::int`,
      d365_u: sql<number>`count(*) FILTER (WHERE ${updatedFilter(d365)})::int`,
    })
    .from(conversations)
    .where(nonCronDebug);

  const msgRows = await db
    .select({
      today_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(t)})::int`,
      yesterday_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(y)})::int`,
      dby_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(dby)})::int`,
      d7_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(d7)})::int`,
      d30_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(d30)})::int`,
      d90_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(d90)})::int`,
      d365_m: sql<number>`count(*) FILTER (WHERE ${msgTsFilter(d365)})::int`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
    .where(sql`${nonCronDebug} AND ${messages.payload}->>'role' = 'user'`);

  const c = convRows[0];
  const m = msgRows[0];

  return {
    today: packWindowCounts(c?.today_c, c?.today_u, m?.today_m),
    yesterday: packWindowCounts(c?.yesterday_c, c?.yesterday_u, m?.yesterday_m),
    day_before_yesterday: packWindowCounts(c?.dby_c, c?.dby_u, m?.dby_m),
    last_7d: packWindowCounts(c?.d7_c, c?.d7_u, m?.d7_m),
    last_30d: packWindowCounts(c?.d30_c, c?.d30_u, m?.d30_m),
    last_90d: packWindowCounts(c?.d90_c, c?.d90_u, m?.d90_m),
    last_365d: packWindowCounts(c?.d365_c, c?.d365_u, m?.d365_m),
  };
}

export function emptyUserActivityStats(): UserActivityStats {
  return {
    today: { ...EMPTY },
    yesterday: { ...EMPTY },
    day_before_yesterday: { ...EMPTY },
    last_7d: { ...EMPTY },
    last_30d: { ...EMPTY },
    last_90d: { ...EMPTY },
    last_365d: { ...EMPTY },
  };
}
