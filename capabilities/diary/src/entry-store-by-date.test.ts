import { beforeEach, describe, expect, it, mock } from "bun:test";
import { DIARY_ENTRY_COMPONENT } from "@freeanima/core/db/schema/entity";
import type { EntityRow } from "@freeanima/core/db/schema/entity";
import { omitUndefined } from "@freeanima/core/util";

const ctx = { worldId: 42 };
const baseTime = new Date("2026-06-28T04:00:00.000Z");
const rows = new Map<number, EntityRow>();
let nextId = 1;

function makeDiaryRow(input: {
  id?: number;
  entry_at: string;
  content?: string;
  tags?: string[];
}): EntityRow {
  const id = input.id ?? nextId++;
  return {
    id,
    type: "content",
    world_id: ctx.worldId,
    components: [DIARY_ENTRY_COMPONENT],
    primary_component: DIARY_ENTRY_COMPONENT,
    title: input.entry_at.slice(0, 10),
    summary: "",
    content: input.content ?? "",
    body: { entry_at: input.entry_at, tags: input.tags ?? [] },
    created_at: baseTime,
    updated_at: baseTime,
  };
}

beforeEach(() => {
  rows.clear();
  nextId = 1;
});

mock.module("@freeanima/core/db/pg/entity", () => ({
  searchEntities: mock(
    async (opts: {
      world_id: number;
      primary_component: string;
      filters?: Record<string, string>;
      limit?: number;
    }) => {
      let list = [...rows.values()].filter(
        (row) => row.world_id === opts.world_id && row.primary_component === opts.primary_component,
      );
      const filters = opts.filters;
      if (filters?.entry_after) {
        list = list.filter((row) => String(row.body.entry_at) >= filters.entry_after!);
      }
      if (filters?.entry_before) {
        list = list.filter((row) => String(row.body.entry_at) <= filters.entry_before!);
      }
      return { results: list.slice(0, opts.limit ?? list.length), count: list.length };
    },
  ),
  createEntity: mock(
    async (input: {
      world_id: number;
      title: string;
      content?: string;
      body: { entry_at: string; tags?: string[] };
    }) => {
      const row = makeDiaryRow(
        omitUndefined({
          entry_at: input.body.entry_at,
          content: input.content ?? "",
          tags: input.body.tags,
        }),
      );
      row.title = input.title;
      rows.set(row.id, row);
      return row;
    },
  ),
  getEntity: mock(async (id: number) => rows.get(id) ?? null),
  updateEntity: mock(
    async (input: {
      id: number;
      title?: string;
      content?: string;
      summary?: string;
      body?: Record<string, unknown>;
    }) => {
      const existing = rows.get(input.id);
      if (!existing) return null;
      const updated: EntityRow = {
        ...existing,
        title: input.title ?? existing.title,
        summary: input.summary ?? existing.summary,
        content: input.content ?? existing.content,
        body: input.body != null ? { ...existing.body, ...input.body } : existing.body,
        updated_at: new Date(baseTime.getTime() + 1000),
      };
      rows.set(input.id, updated);
      return updated;
    },
  ),
  deleteEntity: mock(async (id: number) => rows.delete(id)),
}));

import { appendDiaryEntryByDate } from "./entry-store.ts";

describe("appendDiaryEntryByDate", () => {
  it("creates empty shell then appends when no entry for date", async () => {
    const result = await appendDiaryEntryByDate(ctx, {
      date: "2026-06-28",
      content: "first line",
      tags: ["work"],
    });
    expect(result.content).toBe("first line");
    expect(result.entry_at).toBe("2026-06-28T12:00:00+08:00");
    expect(result.tags).toEqual(["work"]);
    expect(rows.size).toBe(1);
  });

  it("appends to existing entry for date", async () => {
    const seed = makeDiaryRow({
      id: 7,
      entry_at: "2026-06-28T12:00:00+08:00",
      content: "already",
    });
    rows.set(seed.id, seed);

    const result = await appendDiaryEntryByDate(ctx, {
      date: "2026-06-28",
      content: "more",
    });
    expect(result.content).toBe("already\n\nmore");
    expect(result.id).toBe(7);
    expect(rows.size).toBe(1);
  });
});
