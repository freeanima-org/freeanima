import {
  NARRATIVE_COMPONENT,
  type NarrativeSignificance,
  type NarrativeStatus,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  getMemoryBrick,
  listBricksByComponent,
  resolveMemoryBrickWorldId,
  searchBricksByComponent,
  type MemoryBrickRow,
} from "@freeanima/habitat/core/db/pg/memory-brick";

import { coerceString } from "@freeanima/shared/coerce-string";

import type {
  AutobiographicalFtsHit,
  AutobiographicalListOpts,
  AutobiographicalListOrder,
  AutobiographicalMemoryRow,
} from "./types.ts";

function brickToRow(b: MemoryBrickRow): AutobiographicalMemoryRow {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- body.significance 运行时枚举
  const significance = (b.body.significance as NarrativeSignificance | undefined) ?? "normal";
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- body.status 运行时枚举
  const status = (b.body.status as NarrativeStatus | undefined) ?? "active";
  const facts = b.body.source_facts;
  const convs = b.body.source_conversations;
  return {
    id: String(b.id),
    title: b.title,
    content: b.content,
    significance,
    period_start: b.body.period_start == null ? null : coerceString(b.body.period_start),
    period_end: b.body.period_end == null ? null : coerceString(b.body.period_end),
    source_facts: Array.isArray(facts)
      ? facts.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
      : [],
    source_conversations: Array.isArray(convs) ? convs.map(String) : [],
    status,
    created_at: new Date(b.created_at),
    updated_at: new Date(b.updated_at),
    fts_segmented: null,
    content_embedding: null,
  };
}

export async function getAutobiographicalMemory(
  id: string,
): Promise<AutobiographicalMemoryRow | null> {
  const worldId = await resolveMemoryBrickWorldId();
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) return null;
  const brick = await getMemoryBrick(worldId, numId);
  if (!brick || !brick.components.includes(NARRATIVE_COMPONENT)) return null;
  return brickToRow(brick);
}

async function listAllNarrative(limit = 500): Promise<AutobiographicalMemoryRow[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const bricks = await listBricksByComponent(worldId, NARRATIVE_COMPONENT, { limit });
  return bricks.map(brickToRow);
}

export async function countAutobiographicalMemory(
  opts: AutobiographicalListOpts = {},
): Promise<number> {
  const rows = await listAutobiographicalMemory({ ...opts, limit: 500, offset: 0 });
  return rows.length;
}

export async function listActiveAutobiographicalMemory(
  opts: {
    limit?: number;
    order?: AutobiographicalListOrder;
  } = {},
): Promise<AutobiographicalMemoryRow[]> {
  let rows = (await listAllNarrative(opts.limit ?? 100)).filter((r) => r.status === "active");
  if (opts.order === "significance_desc") {
    const rank = { turning_point: 3, milestone: 2, normal: 1 };
    rows = rows.toSorted((a, b) => rank[b.significance] - rank[a.significance]);
  } else {
    rows = rows.toSorted((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }
  return rows.slice(0, opts.limit ?? 100);
}

export async function listAutobiographicalMemoryCreatedSince(
  iso: string,
  opts: { limit?: number } = {},
): Promise<AutobiographicalMemoryRow[]> {
  const since = Date.parse(iso);
  let rows = (await listAllNarrative(200)).filter(
    (r) => r.status === "active" && r.created_at.getTime() >= since,
  );
  rows = rows.toSorted((a, b) => b.created_at.getTime() - a.created_at.getTime());
  return rows.slice(0, opts.limit ?? 50);
}

export async function listAutobiographicalMemoryBySourceSemanticMemory(
  ids: number[],
  opts: { limit?: number } = {},
): Promise<AutobiographicalMemoryRow[]> {
  if (ids.length === 0) return [];
  const set = new Set(ids);
  return (await listAllNarrative(200))
    .filter((r) => r.status === "active" && r.source_facts.some((f) => set.has(f)))
    .slice(0, opts.limit ?? 50);
}

export async function listAutobiographicalMemoryBySourceSessions(
  ids: string[],
  opts: { limit?: number } = {},
): Promise<AutobiographicalMemoryRow[]> {
  if (ids.length === 0) return [];
  const set = new Set(ids);
  return (await listAllNarrative(200))
    .filter((r) => r.status === "active" && r.source_conversations.some((c) => set.has(c)))
    .slice(0, opts.limit ?? 50);
}

export async function listAutobiographicalMemory(
  opts: AutobiographicalListOpts = {},
): Promise<AutobiographicalMemoryRow[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);
  let bricks: MemoryBrickRow[];
  if (opts.query?.trim()) {
    bricks = await searchBricksByComponent(worldId, NARRATIVE_COMPONENT, opts.query.trim(), {
      limit: limit + offset + 50,
    });
  } else {
    bricks = await listBricksByComponent(worldId, NARRATIVE_COMPONENT, {
      limit: limit + offset + 50,
    });
  }
  let rows = bricks.map(brickToRow);
  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  if (opts.significance) rows = rows.filter((r) => r.significance === opts.significance);
  if (opts.source_conversation) {
    const sourceConversation = opts.source_conversation;
    rows = rows.filter((r) => r.source_conversations.includes(sourceConversation));
  }
  return rows.slice(offset, offset + limit);
}

export async function searchAutobiographicalMemoryFts(
  query: string,
  opts: { limit?: number } = {},
): Promise<AutobiographicalFtsHit[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const bricks = await searchBricksByComponent(worldId, NARRATIVE_COMPONENT, query, {
    limit: opts.limit ?? 30,
  });
  return bricks
    .map(brickToRow)
    .filter((r) => r.status === "active")
    .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
}
