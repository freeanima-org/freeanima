import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { omitUndefined } from "@freeanima/core/util";

import {
  appendDiaryEntryByDate,
  deleteDiaryEntryByDate,
  listDiaryEntries,
  searchDiaryEntries,
  updateDiaryEntryByDate,
} from "./entry-store.ts";
import {
  entryPayload,
  parseTagIds,
  parseTags,
  requireEntryByDate,
  resolveFilterTagIds,
  toolDateKey,
} from "./diary-tool-helpers.ts";
import { DIARY_TOOL_RETURNS } from "./return-schemas.ts";
import { resolveDiaryToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";

async function storeContext(args: Record<string, unknown>, access: "read" | "write" = "read") {
  const worldId = await resolveDiaryToolWorld(args, access);
  if (typeof worldId === "string") return worldId;
  return { worldId };
}

async function handleAppend(args: Record<string, unknown>): Promise<string> {
  const content = String(args.content ?? "").trim();
  if (!content) return toolError("content is required");

  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;

  try {
    const item = await appendDiaryEntryByDate(
      ctx,
      omitUndefined({
        date: args.date != null ? String(args.date) : undefined,
        content,
        tags: parseTags(args.tags),
      }),
    );
    return toolResult({ ok: true, action: "append", item: entryPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const hasPatch =
    args.tags !== undefined ||
    args.tag_ids !== undefined ||
    args.title !== undefined ||
    args.summary !== undefined;
  if (!hasPatch) return toolError("at least one of tags, tag_ids, title, summary is required");

  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;

  try {
    const resolved = await requireEntryByDate(ctx, args.date);
    if ("error" in resolved) return toolError(resolved.error);

    const item = await updateDiaryEntryByDate(
      ctx,
      omitUndefined({
        date: resolved.dateKey,
        title: args.title !== undefined ? String(args.title) : undefined,
        summary: args.summary !== undefined ? String(args.summary) : undefined,
        tags: parseTags(args.tags),
        tag_ids: parseTagIds(args.tag_ids),
      }),
    );
    if (!item) return toolError(`diary entry not found for date ${resolved.dateKey}`);
    return toolResult({ ok: true, action: "update", item: entryPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleDelete(args: Record<string, unknown>): Promise<string> {
  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;

  try {
    const dateKey = toolDateKey(args.date);
    const ok = await deleteDiaryEntryByDate(ctx, dateKey);
    if (!ok) return toolError(`diary entry not found for date ${dateKey}`);
    return toolResult({ ok: true, action: "delete", date: dateKey });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGet(args: Record<string, unknown>): Promise<string> {
  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;

  try {
    const resolved = await requireEntryByDate(ctx, args.date);
    if ("error" in resolved) return toolError(resolved.error);
    return toolResult({ ok: true, action: "get", item: entryPayload(resolved.entry) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(500, Math.floor(args.limit)))
      : 20;
  const offset =
    typeof args.offset === "number" && Number.isFinite(args.offset)
      ? Math.max(0, Math.floor(args.offset))
      : 0;
  const entry_after =
    args.entry_after != null && String(args.entry_after).trim()
      ? String(args.entry_after).trim()
      : undefined;
  const entry_before =
    args.entry_before != null && String(args.entry_before).trim()
      ? String(args.entry_before).trim()
      : undefined;

  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;

  try {
    const tags = parseTags(args.tags);
    const rawTagIds = parseTagIds(args.tag_ids);
    const tag_ids = await resolveFilterTagIds(ctx.worldId, {
      ...(tags !== undefined ? { tags } : {}),
      ...(rawTagIds !== undefined ? { tag_ids: rawTagIds } : {}),
    });
    if (tag_ids !== undefined && tag_ids.length === 0) {
      return toolResult({
        ok: true,
        action: "list",
        count: 0,
        items: [],
      });
    }
    const items = await listDiaryEntries(
      ctx,
      omitUndefined({
        entry_after,
        entry_before,
        tag_ids,
        limit,
        offset,
      }),
    );
    return toolResult({
      ok: true,
      action: "list",
      count: items.length,
      items: items.map(entryPayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query ?? "").trim();
  if (!query) return toolError("query is required");

  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;

  try {
    const tags = parseTags(args.tags);
    const rawTagIds = parseTagIds(args.tag_ids);
    const tag_ids = await resolveFilterTagIds(ctx.worldId, {
      ...(tags !== undefined ? { tags } : {}),
      ...(rawTagIds !== undefined ? { tag_ids: rawTagIds } : {}),
    });
    if (tag_ids !== undefined && tag_ids.length === 0) {
      return toolResult({
        ok: true,
        action: "search",
        count: 0,
        items: [],
      });
    }
    const items = await searchDiaryEntries(
      ctx,
      omitUndefined({
        query,
        entry_after:
          args.entry_after != null ? String(args.entry_after).trim() || undefined : undefined,
        entry_before:
          args.entry_before != null ? String(args.entry_before).trim() || undefined : undefined,
        tag_ids,
        limit,
      }),
    );
    return toolResult({
      ok: true,
      action: "search",
      count: items.length,
      items: items.map(entryPayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export function registerDiaryTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "diary",
    "Diary by date in caller subject private world; world_id optional.",
    attachToolReturns(
      [
        {
          name: "diary_append",
          description:
            "Append a new text block to a diary entry for date (creates empty entry if missing; default date is today)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
              content: { type: "string", description: "Text for the new block" },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags when creating a new entry for this date",
              },
            },
            required: ["content"],
          },
          handler: handleAppend,
        },
        {
          name: "diary_update",
          description:
            "Update diary entry metadata for a date (title/summary/tags/tag_ids; default today). Body text: use diary_append or content-block tools",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
              title: { type: "string" },
              summary: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              tag_ids: { type: "array", items: { type: "integer" } },
            },
          },
          handler: handleUpdate,
        },
        {
          name: "diary_delete",
          description: "Delete diary entry for a date (default today)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
            },
          },
          handler: handleDelete,
        },
        {
          name: "diary_get",
          description: "Get diary entry for a date (default today)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
            },
          },
          handler: handleGet,
        },
        {
          name: "diary_list",
          description:
            "List diary entries (default entry_at DESC, limit 20) with optional date/tag filters and offset pagination. items.blocks is always []; use diary_get for body text",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              entry_after: { type: "string", description: "ISO8601 lower bound on entry_at" },
              entry_before: { type: "string", description: "ISO8601 upper bound on entry_at" },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Filter by tag titles (AND)",
              },
              tag_ids: {
                type: "array",
                items: { type: "integer" },
                description: "Filter by tag entity ids (AND)",
              },
              limit: { type: "integer", description: "Page size; default 20, max 500" },
              offset: { type: "integer", description: "Skip N rows; default 0" },
            },
          },
          handler: handleList,
        },
        {
          name: "diary_search",
          description:
            "Hybrid search diary entries by text query. items.blocks is always []; use diary_get for body text",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string" },
              entry_after: { type: "string" },
              entry_before: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Filter by tag titles (AND)",
              },
              tag_ids: {
                type: "array",
                items: { type: "integer" },
                description: "Filter by tag entity ids (AND)",
              },
              limit: { type: "integer" },
            },
            required: ["query"],
          },
          handler: handleSearch,
        },
      ],
      DIARY_TOOL_RETURNS,
    ),
  );
}
