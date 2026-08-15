import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { coerceString } from "@freeanima/shared/coerce-string";

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
  CONTENT_BLOCK_SEARCH_ORDER_BY,
  CONTENT_BLOCK_TYPES,
  LIMBIC_KINDS,
  SEMANTIC_COMPONENT_TAGS,
  WORLD_ID_OPTIONAL,
  blockPayload,
  parseBlockType,
  parseLimbicKind,
  parseOptionalFloat,
  parseSearchOrderBy,
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

  if (args.limbic !== undefined || args.narrative !== undefined || args.dream !== undefined) {
    return toolError(
      "limbic / dream / narrative 写入已拆除（#16102）；存量只读，请用 text / semantic_ref",
    );
  }

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
        content: args.content != null ? coerceString(args.content) : undefined,
        title: args.title != null ? coerceString(args.title) : undefined,
        summary: args.summary != null ? coerceString(args.summary) : undefined,
        sort_order: sortOrder,
        url:
          args.url === undefined
            ? undefined
            : args.url == null || args.url === ""
              ? null
              : coerceString(args.url),
        client_op_id:
          args.client_op_id != null && args.client_op_id !== ""
            ? coerceString(args.client_op_id)
            : undefined,
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

  if (args.limbic !== undefined || args.narrative !== undefined || args.dream !== undefined) {
    return toolError("limbic / dream / narrative 写入已拆除（#16102）；存量只读，不可附加或清除");
  }

  const patch: ContentBlockUpdateInput = { id };
  if (args.content !== undefined) patch.content = coerceString(args.content);
  if (args.title !== undefined) patch.title = coerceString(args.title);
  if (args.summary !== undefined) patch.summary = coerceString(args.summary);
  if (args.block_type !== undefined) {
    const blockType = parseBlockType(args.block_type);
    if (!blockType) return toolError(`invalid block_type: ${coerceString(args.block_type)}`);
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
    patch.url = args.url == null || args.url === "" ? null : coerceString(args.url);
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
    if (!blockType) return toolError(`invalid block_type: ${coerceString(args.block_type)}`);
  }

  let component: string | undefined;
  if (args.component != null && args.component !== "") {
    const tag = parseSemanticComponent(args.component);
    if (!tag) {
      return toolError(
        `invalid component: ${coerceString(args.component)} (expected limbic|narrative|semantic_ref|dream)`,
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
  const query = args.query !== undefined ? coerceString(args.query).trim() : undefined;

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
    if (!blockType) return toolError(`invalid block_type: ${coerceString(args.block_type)}`);
  }

  let component: string | undefined;
  if (args.component != null && args.component !== "") {
    const tag = parseSemanticComponent(args.component);
    if (!tag) {
      return toolError(
        `invalid component: ${coerceString(args.component)} (expected limbic|narrative|semantic_ref|dream)`,
      );
    }
    component = tag;
  }

  let kind: ReturnType<typeof parseLimbicKind> | undefined;
  if (args.kind != null && args.kind !== "") {
    kind = parseLimbicKind(args.kind);
    if (!kind) {
      return toolError(`kind must be one of: ${LIMBIC_KINDS.join(", ")}`);
    }
  }

  const conversationId =
    args.conversation_id !== undefined
      ? coerceString(args.conversation_id).trim() || undefined
      : undefined;

  let status: "active" | "deprecated" | "all" | undefined;
  if (args.status != null && args.status !== "") {
    const raw = coerceString(args.status);
    if (raw !== "active" && raw !== "deprecated" && raw !== "all") {
      return toolError("status must be active|deprecated|all");
    }
    status = raw;
  }

  const minIntensity = parseOptionalFloat(args.min_intensity);
  const maxIntensity = parseOptionalFloat(args.max_intensity);
  const minValence = parseOptionalFloat(args.min_valence);
  const maxValence = parseOptionalFloat(args.max_valence);
  if (minIntensity === null) return toolError("invalid min_intensity");
  if (maxIntensity === null) return toolError("invalid max_intensity");
  if (minValence === null) return toolError("invalid min_valence");
  if (maxValence === null) return toolError("invalid max_valence");
  if (minIntensity != null && (minIntensity < 0 || minIntensity > 1)) {
    return toolError("min_intensity must be between 0 and 1");
  }
  if (maxIntensity != null && (maxIntensity < 0 || maxIntensity > 1)) {
    return toolError("max_intensity must be between 0 and 1");
  }
  if (minValence != null && (minValence < -1 || minValence > 1)) {
    return toolError("min_valence must be between -1 and 1");
  }
  if (maxValence != null && (maxValence < -1 || maxValence > 1)) {
    return toolError("max_valence must be between -1 and 1");
  }

  let orderBy: ReturnType<typeof parseSearchOrderBy> | undefined;
  if (args.order_by != null && args.order_by !== "") {
    orderBy = parseSearchOrderBy(args.order_by);
    if (!orderBy) {
      return toolError(`order_by must be one of: ${CONTENT_BLOCK_SEARCH_ORDER_BY.join(", ")}`);
    }
  }

  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  try {
    const items = await searchContentBlocks(
      worldId,
      omitUndefined({
        query: query || undefined,
        parent_id: parentId,
        block_type: blockType ?? undefined,
        component,
        conversation_id: conversationId,
        kind: kind ?? undefined,
        status,
        min_intensity: minIntensity ?? undefined,
        max_intensity: maxIntensity ?? undefined,
        min_valence: minValence ?? undefined,
        max_valence: maxValence ?? undefined,
        order_by: orderBy ?? undefined,
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

const SEMANTIC_REF_PARAM = {
  type: "object",
  description: "Optional semantic_ref component; null clears on update",
  properties: {
    entity_id: { type: "integer", description: "entities.id (primary_component=semantic_memory)" },
  },
  required: ["entity_id"],
} as const;

export function buildContentBlockToolDefs() {
  return attachToolReturns(
    [
      {
        name: "content_block_create",
        description:
          "Create a content_block under a container (parent_id = diary_entry or note). " +
          "Only text / semantic_ref writes; limbic/narrative/dream are historical read-only (#16102).",
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
            semantic_ref: SEMANTIC_REF_PARAM,
          },
          required: ["subject_kind", "parent_id", "block_type"],
        },
        handler: handleCreate,
      },
      {
        name: "content_block_update",
        description:
          "Update content_block fields / semantic_ref. limbic/narrative/dream cannot be attached or cleared (#16102).",
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
            semantic_ref: SEMANTIC_REF_PARAM,
          },
          required: ["id"],
        },
        handler: handleUpdate,
      },
      {
        name: "content_block_delete",
        description: "Delete a content_block by id",
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
          "List content_blocks under a container (parent_id required), ordered by sort_order. Optional block_type / component (limbic|narrative|semantic_ref|dream) filters for historical reads.",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            parent_id: { type: "integer", description: "Container entity id" },
            block_type: { type: "string", enum: [...CONTENT_BLOCK_TYPES] },
            component: {
              type: "string",
              enum: [...SEMANTIC_COMPONENT_TAGS],
              description: "Filter by semantic component tag (read-only for parked tags)",
            },
            limit: { type: "integer" },
          },
          required: ["subject_kind", "parent_id"],
        },
        handler: handleList,
      },
      {
        name: "content_block_search",
        description:
          "Search content_blocks. With query: hybrid FTS; without query: filter_only list. " +
          "Historical emotion / autobiographical: component=limbic|narrative (read-only). " +
          "Limbic filters: kind, conversation_id, intensity/valence range, order_by. " +
          "Narrative: defaults to status=active (override with status).",
        parameters: {
          type: "object",
          properties: {
            ...WORLD_ID_OPTIONAL,
            query: {
              type: "string",
              description:
                "Full-text keywords (hybrid). Optional; omit/empty for filter-only list.",
            },
            parent_id: { type: "integer", description: "Optional container scope" },
            block_type: { type: "string", enum: [...CONTENT_BLOCK_TYPES] },
            component: {
              type: "string",
              enum: [...SEMANTIC_COMPONENT_TAGS],
              description: "limbic=emotion bricks; narrative=autobiographical (historical)",
            },
            conversation_id: {
              type: "string",
              description: "Filter limbic bricks by conversation_id",
            },
            kind: {
              type: "string",
              enum: [...LIMBIC_KINDS],
              description: "Limbic kind: conversation_mood | turning_point | spike",
            },
            status: {
              type: "string",
              enum: ["active", "deprecated", "all"],
              description:
                "Narrative status; component=narrative defaults to active; all=no filter",
            },
            min_intensity: {
              type: "number",
              description: "Minimum limbic intensity (0..1, inclusive)",
            },
            max_intensity: {
              type: "number",
              description: "Maximum limbic intensity (0..1, inclusive)",
            },
            min_valence: {
              type: "number",
              description: "Minimum limbic valence (-1..1, inclusive)",
            },
            max_valence: {
              type: "number",
              description: "Maximum limbic valence (-1..1, inclusive)",
            },
            order_by: {
              type: "string",
              enum: [...CONTENT_BLOCK_SEARCH_ORDER_BY],
              description:
                "Sort order; default created_desc (filter-only). Hybrid keeps relevance unless set.",
            },
            limit: { type: "integer", description: "Max results, default 30, cap 50" },
          },
          required: ["subject_kind"],
        },
        handler: handleSearch,
      },
      {
        name: "content_block_reorder",
        description: "Batch update sort_order for content_blocks: items=[{id, sort_order}, …]",
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
    ),
  );
}
