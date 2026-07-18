import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/core/db/pg/entity";
import { omitUndefined } from "@freeanima/core/util";
import type { ToolSetRegistry } from "@freeanima/core/tool";

import {
  createTag,
  deleteTag,
  listTags,
  searchTags,
  setEntityTagIds,
  updateTag,
} from "./tag-store.ts";
import { TAG_TOOL_RETURNS } from "./return-schemas.ts";

const WORLD_ID_OPTIONAL = {
  world_id: {
    type: "integer",
    description: "Optional world override; defaults to caller subject private world",
  },
} as const;

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

async function resolveTagToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    return await resolveToolWorld({
      ...(explicit != null ? { explicitWorldId: explicit } : {}),
      ...(opts.entityId != null ? { entityId: opts.entityId } : {}),
      access: opts.access ?? "read",
    });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}

function tagPayload(row: { id: number; title: string; sort_order: number }) {
  return { id: row.id, title: row.title, sort_order: row.sort_order };
}

function parseTagIds(raw: unknown): number[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: number[] = [];
  for (const item of raw) {
    const id = Number(item);
    if (Number.isFinite(id) && id > 0) out.push(Math.floor(id));
  }
  return out;
}

export function registerTagTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "tag",
    "Per-world flat tags: create/edit/delete tags; set tag_ids on any entity.",
    attachToolReturns(
      [
        {
          name: "tag_list",
          description: "List tags in the world (sorted)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL },
          },
          handler: async (args) => {
            const worldId = await resolveTagToolWorld({ args });
            if (typeof worldId === "string") return worldId;
            const tags = await listTags(worldId);
            return toolResult({
              ok: true,
              action: "list",
              count: tags.length,
              tags: tags.map(tagPayload),
            });
          },
        },
        {
          name: "tag_search",
          description: "Search tags by title text",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string" },
              limit: { type: "integer" },
              offset: { type: "integer" },
            },
          },
          handler: async (args) => {
            const worldId = await resolveTagToolWorld({ args });
            if (typeof worldId === "string") return worldId;
            const result = await searchTags(
              worldId,
              omitUndefined({
                query: args.query != null ? String(args.query) : undefined,
                limit: args.limit != null ? Number(args.limit) : undefined,
                offset: args.offset != null ? Number(args.offset) : undefined,
              }),
            );
            return toolResult({
              ok: true,
              action: "search",
              count: result.count,
              tags: result.tags.map(tagPayload),
            });
          },
        },
        {
          name: "tag_create",
          description: "Create a tag in the world (title unique per world)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              title: { type: "string" },
              sort_order: { type: "integer" },
            },
            required: ["title"],
          },
          handler: async (args) => {
            const worldId = await resolveTagToolWorld({ args, access: "write" });
            if (typeof worldId === "string") return worldId;
            try {
              const item = await createTag(
                worldId,
                omitUndefined({
                  title: String(args.title ?? ""),
                  sort_order: args.sort_order != null ? Number(args.sort_order) : undefined,
                }),
              );
              return toolResult({ ok: true, action: "create", item: tagPayload(item) });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
        {
          name: "tag_update",
          description: "Update tag title or sort_order",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "integer" },
              title: { type: "string" },
              sort_order: { type: "integer" },
            },
            required: ["id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            const worldId = await resolveTagToolWorld({
              args,
              entityId: id,
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            try {
              const item = await updateTag(
                worldId,
                omitUndefined({
                  id,
                  title: args.title != null ? String(args.title) : undefined,
                  sort_order: args.sort_order != null ? Number(args.sort_order) : undefined,
                }),
              );
              if (!item) return toolError(`tag not found: ${id}`);
              return toolResult({ ok: true, action: "update", item: tagPayload(item) });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
        {
          name: "tag_delete",
          description: "Delete a tag and remove it from all entities in the world",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL, id: { type: "integer" } },
            required: ["id"],
          },
          handler: async (args) => {
            const id = Number(args.id);
            const worldId = await resolveTagToolWorld({
              args,
              entityId: id,
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            const ok = await deleteTag(worldId, id);
            if (!ok) return toolError(`tag not found: ${id}`);
            return toolResult({ ok: true, action: "delete", id });
          },
        },
        {
          name: "tag_set_on_entity",
          description: "Replace tag_ids on an entity (same world; empty array clears)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              entity_id: { type: "integer" },
              tag_ids: { type: "array", items: { type: "integer" } },
            },
            required: ["entity_id", "tag_ids"],
          },
          handler: async (args) => {
            const entityId = Number(args.entity_id);
            const tagIds = parseTagIds(args.tag_ids);
            if (tagIds == null) return toolError("tag_ids must be an array of integers");
            const worldId = await resolveTagToolWorld({
              args,
              entityId,
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            try {
              const result = await setEntityTagIds(worldId, entityId, tagIds);
              return toolResult({
                ok: true,
                action: "set_on_entity",
                entity_id: result.entity_id,
                tag_ids: result.tag_ids,
              });
            } catch (e) {
              return toolError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
      TAG_TOOL_RETURNS,
    ),
  );
}
