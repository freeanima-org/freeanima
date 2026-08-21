import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { coerceString } from "@freeanima/shared/coerce-string";

import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  searchNotes,
  updateNote,
} from "./note-store.ts";
import { NOTE_TOOL_RETURNS } from "./return-schemas.ts";
import { resolveNoteToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";
import type { NoteRow } from "./types.ts";

async function storeContext(
  args: Record<string, unknown>,
  access: "read" | "write" = "read",
  entityId?: number,
) {
  const worldId = await resolveNoteToolWorld({
    args,
    access,
    ...(entityId != null ? { entityId } : {}),
  });
  if (typeof worldId === "string") return worldId;
  return { worldId };
}

function parseId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

function parseTagIds(raw: unknown): number[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const ids = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.floor(n));
  return ids.length > 0 ? ids : undefined;
}

function parseTags(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const tags = raw.map((v) => coerceString(v).trim()).filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function notePayload(item: NoteRow) {
  return item;
}

async function handleCreate(args: Record<string, unknown>): Promise<string> {
  const title = coerceString(args.title ?? "").trim();
  if (!title) return toolError("title is required");

  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;

  try {
    const item = await createNote(
      ctx,
      omitUndefined({
        title,
        content: args.content != null ? coerceString(args.content) : undefined,
        summary: args.summary != null ? coerceString(args.summary) : undefined,
        tags: parseTags(args.tags),
        tag_ids: parseTagIds(args.tag_ids),
      }),
    );
    return toolResult({ ok: true, action: "create", item: notePayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const id = parseId(args.id);
  if (id == null) return toolError("id is required");

  const hasPatch =
    args.tags !== undefined ||
    args.tag_ids !== undefined ||
    args.title !== undefined ||
    args.summary !== undefined;
  if (!hasPatch) return toolError("at least one of tags, tag_ids, title, summary is required");

  const ctx = await storeContext(args, "write", id);
  if (typeof ctx === "string") return ctx;

  try {
    const item = await updateNote(
      ctx,
      omitUndefined({
        id,
        title: args.title !== undefined ? coerceString(args.title) : undefined,
        summary: args.summary !== undefined ? coerceString(args.summary) : undefined,
        tags: parseTags(args.tags),
        tag_ids: parseTagIds(args.tag_ids),
      }),
    );
    if (!item) return toolError(`note not found: ${id}`);
    return toolResult({ ok: true, action: "update", item: notePayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleDelete(args: Record<string, unknown>): Promise<string> {
  const id = parseId(args.id);
  if (id == null) return toolError("id is required");

  const ctx = await storeContext(args, "write", id);
  if (typeof ctx === "string") return ctx;

  try {
    const ok = await deleteNote(ctx, id);
    if (!ok) return toolError(`note not found: ${id}`);
    return toolResult({ ok: true, action: "delete", id });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGet(args: Record<string, unknown>): Promise<string> {
  const id = parseId(args.id);
  if (id == null) return toolError("id is required");

  const ctx = await storeContext(args, "read", id);
  if (typeof ctx === "string") return ctx;

  try {
    const item = await getNote(ctx, id);
    if (!item) return toolError(`note not found: ${id}`);
    return toolResult({ ok: true, action: "get", item: notePayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;

  try {
    const limit = args.limit != null ? Number(args.limit) : undefined;
    const offset = args.offset != null ? Number(args.offset) : undefined;
    const items = await listNotes(
      ctx,
      omitUndefined({
        tag_ids: parseTagIds(args.tag_ids),
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
      }),
    );
    return toolResult({
      ok: true,
      action: "list",
      count: items.length,
      items: items.map(notePayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleSearch(args: Record<string, unknown>): Promise<string> {
  const query = coerceString(args.query ?? "").trim();
  if (!query) return toolError("query is required");

  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;

  try {
    const limit = args.limit != null ? Number(args.limit) : undefined;
    const items = await searchNotes(
      ctx,
      omitUndefined({
        query,
        tag_ids: parseTagIds(args.tag_ids),
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    );
    return toolResult({
      ok: true,
      action: "search",
      count: items.length,
      items: items.map(notePayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export function buildNoteToolDefs() {
  return attachToolReturns(
    [
      {
        name: "note_create",
        description:
          "Create a note; optional first text block via content; optional tags / tag_ids.",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            title: { type: "string" },
            content: { type: "string", description: "Optional first Markdown text block" },
            summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            tag_ids: { type: "array", items: { type: "integer" } },
          },
          required: ["subject_id", "title"],
        },
        handler: handleCreate,
      },
      {
        name: "note_update",
        description: "Update note metadata (title/summary/tags). Does not edit body blocks.",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            id: { type: "integer" },
            title: { type: "string" },
            summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            tag_ids: { type: "array", items: { type: "integer" } },
          },
          required: ["subject_id", "id"],
        },
        handler: handleUpdate,
      },
      {
        name: "note_get",
        description: "Get a note by id including text blocks.",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            id: { type: "integer" },
          },
          required: ["subject_id", "id"],
        },
        handler: handleGet,
      },
      {
        name: "note_delete",
        description: "Soft-delete a note and cascade its text blocks.",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            id: { type: "integer" },
          },
          required: ["subject_id", "id"],
        },
        handler: handleDelete,
      },
      {
        name: "note_list",
        description: "List notes ordered by updated_at desc. Optional tag_ids filter.",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            tag_ids: { type: "array", items: { type: "integer" } },
            limit: { type: "integer" },
            offset: { type: "integer" },
          },
          required: ["subject_id"],
        },
        handler: handleList,
      },
      {
        name: "note_search",
        description:
          "Hybrid search over note text blocks; returns matching notes (relevance order).",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            query: { type: "string" },
            tag_ids: { type: "array", items: { type: "integer" } },
            limit: { type: "integer" },
          },
          required: ["subject_id", "query"],
        },
        handler: handleSearch,
      },
    ],
    NOTE_TOOL_RETURNS,
  );
}
