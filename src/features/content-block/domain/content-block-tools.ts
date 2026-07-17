import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { omitUndefined } from "@freeanima/core/util";

import {
  createContentBlock,
  deleteContentBlock,
  getContentBlock,
  listContentBlocks,
  reorderContentBlocks,
  searchContentBlocks,
  updateContentBlock,
} from "./block-store.ts";
import {
  CONTENT_BLOCK_TYPES,
  SEMANTIC_COMPONENT_TAGS,
  WORLD_ID_OPTIONAL,
  blockPayload,
  parseBlockType,
  parseLimbic,
  parseNarrative,
  parseSemanticComponent,
  parseSemanticRef,
} from "./block-tool-helpers.ts";
import { CONTENT_BLOCK_TOOL_RETURNS } from "./return-schemas.ts";
import { resolveContentBlockToolWorld } from "./tool-world-resolve.ts";
import type { ContentBlockReorderItem, ContentBlockUpdateInput } from "./types.ts";

async function handleCreate(args: Record<string, unknown>): Promise<string> {
  const parentId = Number(args.parent_id);
  if (!Number.isFinite(parentId) || parentId <= 0) return toolError("parent_id is required");

  const worldId = await resolveContentBlockToolWorld({
    args,
    entityId: parentId,
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  const blockType = parseBlockType(args.block_type);
  if (!blockType) return toolError("block_type is required and must be a known type");

  const limbic = parseLimbic(args.limbic);
  if (args.limbic !== undefined && limbic === null) return toolError("invalid limbic");
  const narrative = parseNarrative(args.narrative);
  if (args.narrative !== undefined && narrative === null) return toolError("invalid narrative");
  const semanticRef = parseSemanticRef(args.semantic_ref);
  if (args.semantic_ref !== undefined && semanticRef === null) {
    return toolError("invalid semantic_ref");
  }

  const sortOrder =
    args.sort_order != null && args.sort_order !== "" ? Number(args.sort_order) : undefined;
  if (sortOrder !== undefined && !Number.isFinite(sortOrder)) {
    return toolError("invalid sort_order");
  }

  try {
    const item = await createContentBlock(
      worldId,
      omitUndefined({
        parent_id: parentId,
        block_type: blockType,
        content: args.content != null ? String(args.content) : undefined,
        title: args.title != null ? String(args.title) : undefined,
        summary: args.summary != null ? String(args.summary) : undefined,
        sort_order: sortOrder,
        url:
          args.url === undefined
            ? undefined
            : args.url == null || args.url === ""
              ? null
              : String(args.url),
        client_op_id:
          args.client_op_id != null && args.client_op_id !== ""
            ? String(args.client_op_id)
            : undefined,
        limbic: limbic ?? undefined,
        narrative: narrative ?? undefined,
        semantic_ref: semanticRef ?? undefined,
      }),
    );
    return toolResult({ ok: true, action: "create", item: blockPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveContentBlockToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  const patch: ContentBlockUpdateInput = { id };
  if (args.content !== undefined) patch.content = String(args.content);
  if (args.title !== undefined) patch.title = String(args.title);
  if (args.summary !== undefined) patch.summary = String(args.summary);
  if (args.block_type !== undefined) {
    const blockType = parseBlockType(args.block_type);
    if (!blockType) return toolError(`invalid block_type: ${args.block_type}`);
    patch.block_type = blockType;
  }
  if (args.parent_id !== undefined) {
    const parentId = Number(args.parent_id);
    if (!Number.isFinite(parentId) || parentId <= 0) return toolError("invalid parent_id");
    patch.parent_id = parentId;
  }
  if (args.sort_order !== undefined) {
    const sortOrder = Number(args.sort_order);
    if (!Number.isFinite(sortOrder)) return toolError("invalid sort_order");
    patch.sort_order = sortOrder;
  }
  if (args.url !== undefined) {
    patch.url = args.url == null || args.url === "" ? null : String(args.url);
  }
  if (args.limbic !== undefined) {
    const limbic = parseLimbic(args.limbic);
    if (limbic === undefined || (limbic === null && args.limbic !== null)) {
      return toolError("invalid limbic");
    }
    patch.limbic = limbic;
  }
  if (args.narrative !== undefined) {
    const narrative = parseNarrative(args.narrative);
    if (narrative === undefined || (narrative === null && args.narrative !== null)) {
      return toolError("invalid narrative");
    }
    patch.narrative = narrative;
  }
  if (args.semantic_ref !== undefined) {
    const semanticRef = parseSemanticRef(args.semantic_ref);
    if (semanticRef === undefined || (semanticRef === null && args.semantic_ref !== null)) {
      return toolError("invalid semantic_ref");
    }
    patch.semantic_ref = semanticRef;
  }

  try {
    const item = await updateContentBlock(worldId, patch);
    if (!item) return toolError(`content_block not found: ${id}`);
    return toolResult({ ok: true, action: "update", item: blockPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleDelete(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveContentBlockToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  try {
    const ok = await deleteContentBlock(worldId, id);
    if (!ok) return toolError(`content_block not found: ${id}`);
    return toolResult({ ok: true, action: "delete", id });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGet(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveContentBlockToolWorld({ args, entityId: id });
  if (typeof worldId === "string") return worldId;

  const item = await getContentBlock(worldId, id);
  if (!item) return toolError(`content_block not found: ${id}`);
  return toolResult({ ok: true, action: "get", item: blockPayload(item) });
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const parentId = Number(args.parent_id);
  if (!Number.isFinite(parentId) || parentId <= 0) return toolError("parent_id is required");

  const worldId = await resolveContentBlockToolWorld({ args, entityId: parentId });
  if (typeof worldId === "string") return worldId;

  let blockType: ReturnType<typeof parseBlockType> | undefined;
  if (args.block_type != null && args.block_type !== "") {
    blockType = parseBlockType(args.block_type);
    if (!blockType) return toolError(`invalid block_type: ${args.block_type}`);
  }

  let component: string | undefined;
  if (args.component != null && args.component !== "") {
    const tag = parseSemanticComponent(args.component);
    if (!tag) {
      return toolError(
        `invalid component: ${args.component} (expected limbic|narrative|semantic_ref|dream)`,
      );
    }
    component = tag;
  }

  const limit = typeof args.limit === "number" ? args.limit : 100;
  const items = await listContentBlocks(
    worldId,
    omitUndefined({
      parent_id: parentId,
      block_type: blockType ?? undefined,
      component,
      limit,
    }),
  );
  return toolResult({
    ok: true,
    action: "list",
    count: items.length,
    items: items.map(blockPayload),
  });
}

async function handleSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query ?? "").trim();
  if (!query) return toolError("query is required");

  const parentIdRaw = args.parent_id;
  const hasParent =
    parentIdRaw != null && parentIdRaw !== "" && Number.isFinite(Number(parentIdRaw));
  const parentId = hasParent ? Number(parentIdRaw) : undefined;

  const worldId = await resolveContentBlockToolWorld({
    args,
    ...(parentId != null ? { entityId: parentId } : {}),
  });
  if (typeof worldId === "string") return worldId;

  let blockType: ReturnType<typeof parseBlockType> | undefined;
  if (args.block_type != null && args.block_type !== "") {
    blockType = parseBlockType(args.block_type);
    if (!blockType) return toolError(`invalid block_type: ${args.block_type}`);
  }

  let component: string | undefined;
  if (args.component != null && args.component !== "") {
    const tag = parseSemanticComponent(args.component);
    if (!tag) {
      return toolError(
        `invalid component: ${args.component} (expected limbic|narrative|semantic_ref|dream)`,
      );
    }
    component = tag;
  }

  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  try {
    const items = await searchContentBlocks(
      worldId,
      omitUndefined({
        query,
        parent_id: parentId,
        block_type: blockType ?? undefined,
        component,
        limit,
      }),
    );
    return toolResult({
      ok: true,
      action: "search",
      count: items.length,
      items: items.map(blockPayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleReorder(args: Record<string, unknown>): Promise<string> {
  const rawItems = args.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return toolError("items is required (non-empty array of {id, sort_order})");
  }

  const items: ContentBlockReorderItem[] = [];
  for (const raw of rawItems) {
    if (typeof raw !== "object" || raw == null || Array.isArray(raw)) {
      return toolError("each item must be an object with id and sort_order");
    }
    const obj = raw as Record<string, unknown>;
    const id = Number(obj.id);
    const sortOrder = Number(obj.sort_order);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sortOrder)) {
      return toolError("each item requires valid id and sort_order");
    }
    items.push({ id, sort_order: sortOrder });
  }

  const first = items[0];
  if (!first) return toolError("items is required (non-empty array of {id, sort_order})");

  const worldId = await resolveContentBlockToolWorld({
    args,
    entityId: first.id,
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  try {
    const updated = await reorderContentBlocks(worldId, items);
    return toolResult({
      ok: true,
      action: "reorder",
      count: updated.length,
      items: updated.map(blockPayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

const CONTENT_BLOCK_TOOL_NAMES = [
  "content_block_create",
  "content_block_update",
  "content_block_delete",
  "content_block_get",
  "content_block_list",
  "content_block_search",
  "content_block_reorder",
] as const;

const LIMBIC_PARAM = {
  type: "object",
  description: "Optional limbic component ({valence, arousal, intensity}); null clears on update",
  properties: {
    valence: { type: "number", description: "-1..1" },
    arousal: { type: "number", description: "0..1" },
    intensity: { type: "number", description: "0..1" },
  },
  required: ["valence", "arousal", "intensity"],
} as const;

const NARRATIVE_PARAM = {
  type: "object",
  description: "Optional narrative component; null clears on update",
  properties: {
    significance: {
      type: "string",
      enum: ["normal", "milestone", "turning_point"],
    },
  },
} as const;

const SEMANTIC_REF_PARAM = {
  type: "object",
  description: "Optional semantic_ref component; null clears on update",
  properties: {
    entity_id: { type: "integer", description: "entities.id (primary_component=semantic_memory)" },
  },
  required: ["entity_id"],
} as const;

export function registerContentBlockToolSet(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "content-block",
    "Content blocks (CRUD, container list, semantic-component filter, reorder). parent_id scopes to diary_entry container.",
    attachToolReturns(
      [
        {
          name: "content_block_create",
          description:
            "Create a content_block under a container (parent_id = diary_entry). Optional limbic/narrative/semantic_ref/dream attach semantic components.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              parent_id: { type: "integer", description: "Container entity id" },
              block_type: { type: "string", enum: [...CONTENT_BLOCK_TYPES] },
              content: { type: "string", description: "Text body or media caption" },
              title: { type: "string" },
              summary: { type: "string" },
              sort_order: { type: "integer" },
              url: { type: "string", description: "Resource locator for non-text types" },
              client_op_id: { type: "string", description: "Idempotent create key" },
              limbic: LIMBIC_PARAM,
              narrative: NARRATIVE_PARAM,
              semantic_ref: SEMANTIC_REF_PARAM,
            },
            required: ["parent_id", "block_type"],
          },
          handler: handleCreate,
        },
        {
          name: "content_block_update",
          description:
            "Update content_block fields / semantic components. Pass limbic/narrative/semantic_ref null to clear that component.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              id: { type: "integer" },
              content: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              block_type: { type: "string", enum: [...CONTENT_BLOCK_TYPES] },
              parent_id: { type: "integer" },
              sort_order: { type: "integer" },
              url: { type: "string" },
              limbic: LIMBIC_PARAM,
              narrative: NARRATIVE_PARAM,
              semantic_ref: SEMANTIC_REF_PARAM,
            },
            required: ["id"],
          },
          handler: handleUpdate,
        },
        {
          name: "content_block_delete",
          description: "Delete a content_block by id",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: handleDelete,
        },
        {
          name: "content_block_get",
          description: "Get a content_block by id",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: handleGet,
        },
        {
          name: "content_block_list",
          description:
            "List content_blocks under a container (parent_id required), ordered by sort_order. Optional block_type / component (limbic|narrative|semantic_ref|dream) filters.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              parent_id: { type: "integer", description: "Container entity id" },
              block_type: { type: "string", enum: [...CONTENT_BLOCK_TYPES] },
              component: {
                type: "string",
                enum: [...SEMANTIC_COMPONENT_TAGS],
                description: "Filter by semantic component tag",
              },
              limit: { type: "integer" },
            },
            required: ["parent_id"],
          },
          handler: handleList,
        },
        {
          name: "content_block_search",
          description:
            "Hybrid search content_blocks by title/content. Optional parent_id, block_type, component filters.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string", description: "Search keywords" },
              parent_id: { type: "integer", description: "Optional container scope" },
              block_type: { type: "string", enum: [...CONTENT_BLOCK_TYPES] },
              component: {
                type: "string",
                enum: [...SEMANTIC_COMPONENT_TAGS],
              },
              limit: { type: "integer", description: "Max results, default 30, cap 50" },
            },
            required: ["query"],
          },
          handler: handleSearch,
        },
        {
          name: "content_block_reorder",
          description: "Batch update sort_order for content_blocks: items=[{id, sort_order}, …]",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    sort_order: { type: "integer" },
                  },
                  required: ["id", "sort_order"],
                },
              },
            },
            required: ["items"],
          },
          handler: handleReorder,
        },
      ],
      Object.fromEntries(
        CONTENT_BLOCK_TOOL_NAMES.map((name) => [name, CONTENT_BLOCK_TOOL_RETURNS[name]]),
      ) as Partial<typeof CONTENT_BLOCK_TOOL_RETURNS>,
    ),
  );
}
