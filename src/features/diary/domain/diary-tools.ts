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
import { entryPayload, parseTags, requireEntryByDate, toolDateKey } from "./diary-tool-helpers.ts";
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
    args.content !== undefined ||
    args.tags !== undefined ||
    args.title !== undefined ||
    args.summary !== undefined;
  if (!hasPatch) return toolError("at least one of content, tags, title, summary is required");

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
        content: args.content !== undefined ? String(args.content) : undefined,
        summary: args.summary !== undefined ? String(args.summary) : undefined,
        tags: parseTags(args.tags),
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
  const limit = typeof args.limit === "number" ? args.limit : 50;
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
    const items = await listDiaryEntries(
      ctx,
      omitUndefined({
        entry_after,
        entry_before,
        tags: parseTags(args.tags),
        limit,
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
    const items = await searchDiaryEntries(
      ctx,
      omitUndefined({
        query,
        entry_after:
          args.entry_after != null ? String(args.entry_after).trim() || undefined : undefined,
        entry_before:
          args.entry_before != null ? String(args.entry_before).trim() || undefined : undefined,
        tags: parseTags(args.tags),
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
            "Append text to a diary entry for date (creates empty entry if missing; default date is today)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
              content: { type: "string", description: "Text to append" },
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
          description: "Replace diary fields for a date (default today; not append)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
              title: { type: "string" },
              content: { type: "string" },
              summary: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
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
          description: "List diary entries with optional date/tag filters",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              entry_after: { type: "string", description: "ISO8601 lower bound on entry_at" },
              entry_before: { type: "string", description: "ISO8601 upper bound on entry_at" },
              tags: { type: "array", items: { type: "string" } },
              limit: { type: "integer" },
            },
          },
          handler: handleList,
        },
        {
          name: "diary_search",
          description: "Hybrid search diary entries by text query",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string" },
              entry_after: { type: "string" },
              entry_before: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
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
