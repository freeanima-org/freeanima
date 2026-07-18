import { and, eq, sql } from "drizzle-orm";
import {
  TEMPORAL_SUMMARY_COMPONENT,
  entities,
  temporalSummaryBodySchema,
  type TemporalSummaryWindow,
} from "@freeanima/core/db/schema";
import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import { createEntity, updateEntity } from "@freeanima/core/db/pg/entity";
import { getDb } from "../../client.ts";

export type TemporalSummaryRow = {
  id: number;
  window: TemporalSummaryWindow;
  period_start: string;
  content: string;
  updated_at: Date;
};

function agentWorldId(): number {
  return getResolvedWorldContext().agent_world_id;
}

export async function getTemporalSummary(
  window: TemporalSummaryWindow,
  period_start: string,
): Promise<TemporalSummaryRow | null> {
  const db = getDb();
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
        eq(entities.world_id, agentWorldId()),
        sql`${entities.body}->>'window' = ${window}`,
        sql`${entities.body}->>'period_start' = ${period_start}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const body = temporalSummaryBodySchema.parse(row.body ?? {});
  return {
    id: row.id,
    window: body.window,
    period_start: body.period_start,
    content: row.content ?? "",
    updated_at: row.updated_at,
  };
}

export async function upsertTemporalSummary(input: {
  window: TemporalSummaryWindow;
  period_start: string;
  content: string;
}): Promise<number> {
  const content = input.content.trim();
  const body = temporalSummaryBodySchema.parse({
    window: input.window,
    period_start: input.period_start,
  }) as Record<string, unknown>;
  const existing = await getTemporalSummary(input.window, input.period_start);
  const title = `temporal ${input.window} ${input.period_start}`;
  if (existing) {
    await updateEntity({
      id: existing.id,
      title,
      content,
      body,
      summary: content.slice(0, 200),
    });
    return existing.id;
  }
  const created = await createEntity({
    type: "content",
    world_id: agentWorldId(),
    components: [TEMPORAL_SUMMARY_COMPONENT],
    primary_component: TEMPORAL_SUMMARY_COMPONENT,
    title,
    summary: content.slice(0, 200),
    content,
    body,
  });
  return created.id;
}

export async function listTemporalSummariesInRange(input: {
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
}): Promise<TemporalSummaryRow[]> {
  const db = getDb();
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
        eq(entities.world_id, agentWorldId()),
        sql`${entities.body}->>'window' = ${input.window}`,
        sql`${entities.body}->>'period_start' >= ${input.period_start_from}`,
        sql`${entities.body}->>'period_start' <= ${input.period_start_to}`,
      ),
    );
  return rows.map((row) => {
    const body = temporalSummaryBodySchema.parse(row.body ?? {});
    return {
      id: row.id,
      window: body.window,
      period_start: body.period_start,
      content: row.content ?? "",
      updated_at: row.updated_at,
    };
  });
}
