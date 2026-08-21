import { and, eq, sql } from "drizzle-orm";
import {
  TEMPORAL_SUMMARY_COMPONENT,
  entities,
  temporalSummaryBodySchema,
  type TemporalSummaryWindow,
} from "@freeanima/habitat/core/db/schema";
import { createEntity, updateEntity } from "@freeanima/habitat/core/db/pg/entity";
import { getDb } from "../../client.ts";

export type TemporalSummaryRow = {
  id: number;
  window: TemporalSummaryWindow;
  period_start: string;
  content: string;
  empty_reason: string | null;
  source_count: number | null;
  updated_at: Date;
};

function requireWorldId(explicit?: number): number {
  if (explicit == null || explicit <= 0) {
    throw new Error(
      "temporal summary requires world_id (agent private world); no default chat agent fallback",
    );
  }
  return explicit;
}

function mapRow(row: {
  id: number;
  content: string | null;
  body: unknown;
  updated_at: Date;
}): TemporalSummaryRow {
  const body = temporalSummaryBodySchema.parse(row.body ?? {});
  return {
    id: row.id,
    window: body.window,
    period_start: body.period_start,
    content: row.content ?? "",
    empty_reason: body.empty_reason ?? null,
    source_count: body.source_count ?? null,
    updated_at: row.updated_at,
  };
}

export async function getTemporalSummary(
  window: TemporalSummaryWindow,
  period_start: string,
  opts: { world_id: number },
): Promise<TemporalSummaryRow | null> {
  const db = getDb();
  const world_id = requireWorldId(opts.world_id);
  const rows = await db
    .select({
      id: entities.id,
      content: entities.content,
      body: entities.body,
      updated_at: entities.updated_at,
    })
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, TEMPORAL_SUMMARY_COMPONENT),
        eq(entities.world_id, world_id),
        sql`${entities.body}->>'window' = ${window}`,
        sql`${entities.body}->>'period_start' = ${period_start}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function upsertTemporalSummary(input: {
  window: TemporalSummaryWindow;
  period_start: string;
  content: string;
  empty_reason?: string | null;
  source_count?: number;
  world_id: number;
}): Promise<number> {
  const content = input.content.trim();
  const empty_reason = input.empty_reason !== undefined ? input.empty_reason : null;
  const world_id = requireWorldId(input.world_id);
  const body = temporalSummaryBodySchema.parse({
    window: input.window,
    period_start: input.period_start,
    empty_reason,
    ...(input.source_count !== undefined ? { source_count: input.source_count } : {}),
  }) as Record<string, unknown>;
  const existing = await getTemporalSummary(input.window, input.period_start, { world_id });
  const title = `temporal ${input.window} ${input.period_start}`;
  const summary =
    content.slice(0, 200) || (typeof empty_reason === "string" ? `[${empty_reason}]` : "");
  if (existing) {
    await updateEntity({
      id: existing.id,
      title,
      content,
      body,
      summary,
    });
    return existing.id;
  }
  const created = await createEntity({
    type: "content",
    world_id,
    components: [TEMPORAL_SUMMARY_COMPONENT],
    primary_component: TEMPORAL_SUMMARY_COMPONENT,
    title,
    summary,
    content,
    body,
  });
  return created.id;
}

export async function listTemporalSummariesInRange(input: {
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
  world_id: number;
}): Promise<TemporalSummaryRow[]> {
  const db = getDb();
  const world_id = requireWorldId(input.world_id);
  const rows = await db
    .select({
      id: entities.id,
      content: entities.content,
      body: entities.body,
      updated_at: entities.updated_at,
    })
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, TEMPORAL_SUMMARY_COMPONENT),
        eq(entities.world_id, world_id),
        sql`${entities.body}->>'window' = ${input.window}`,
        sql`${entities.body}->>'period_start' >= ${input.period_start_from}`,
        sql`${entities.body}->>'period_start' <= ${input.period_start_to}`,
      ),
    );
  return rows.map(mapRow);
}

/** Paginated list of temporal summaries (newest period_start first). */
export async function listTemporalSummaries(input: {
  window?: TemporalSummaryWindow;
  period_start_from?: string;
  period_start_to?: string;
  offset?: number;
  limit?: number;
  world_id: number;
}): Promise<{ items: TemporalSummaryRow[]; total: number }> {
  const db = getDb();
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.max(1, Math.min(100, input.limit ?? 20));
  const world_id = requireWorldId(input.world_id);
  const conditions = [
    eq(entities.primary_component, TEMPORAL_SUMMARY_COMPONENT),
    eq(entities.world_id, world_id),
  ];
  if (input.window) {
    conditions.push(sql`${entities.body}->>'window' = ${input.window}`);
  }
  if (input.period_start_from) {
    conditions.push(sql`${entities.body}->>'period_start' >= ${input.period_start_from}`);
  }
  if (input.period_start_to) {
    conditions.push(sql`${entities.body}->>'period_start' <= ${input.period_start_to}`);
  }
  const where = and(...conditions);
  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(entities)
    .where(where);
  const rows = await db
    .select({
      id: entities.id,
      content: entities.content,
      body: entities.body,
      updated_at: entities.updated_at,
    })
    .from(entities)
    .where(where)
    .orderBy(sql`${entities.body}->>'period_start' DESC`)
    .limit(limit)
    .offset(offset);
  return {
    total: countRow?.total ?? 0,
    items: rows.map(mapRow),
  };
}
