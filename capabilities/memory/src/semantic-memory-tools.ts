import type { ToolDef } from "@freeanima/core/tool";
import { toolError, toolResult } from "@freeanima/core/tool";
import {
  formatCstIso,
  formatFtsToolError,
  isFtsQueryError,
  validateFtsQueryInput,
} from "@freeanima/core/util";
import type { SemanticMemoryCreateInput, SemanticMemoryUpdateInput } from "@freeanima/core/repos";

import { getSemanticMemoryStore } from "./semantic-port.ts";
import { MEMORY_SEMANTIC_CITATION_TOOL_HINT } from "./memory-reference.ts";
import { getToolConversationIdForMemory } from "./tool-conversation-port.ts";

const MEMORY_TYPES = [
  "world",
  "experience",
  "opinion",
  "observation",
  "preference",
  "procedural",
  "imprint",
] as const;

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

async function handleCreateSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const content = String(args.content ?? "").trim();
  if (!content) return toolError("content is required");

  const row: SemanticMemoryCreateInput = {
    content,
    type: args.type !== undefined ? String(args.type) : undefined,
    pinned: args.pinned !== undefined ? Boolean(args.pinned) : undefined,
    source_conversations: parseStringArray(args.source_conversations),
    observed_at:
      args.observed_at !== undefined && args.observed_at !== null
        ? String(args.observed_at)
        : formatCstIso(),
    occurred_at:
      args.occurred_at !== undefined && args.occurred_at !== null
        ? String(args.occurred_at)
        : undefined,
    status: args.status !== undefined ? String(args.status) : undefined,
  };

  const id = await getSemanticMemoryStore().create(row);
  return toolResult({ ok: true, id, semantic_memory_id: id, action: "create" });
}

function resolveSemanticMemoryId(args: Record<string, unknown>): string {
  return String(args.semantic_memory_id ?? args.fact_id ?? args.id ?? "").trim();
}

function rememberResult(
  action: string,
  semanticMemoryId: string,
  extra?: Record<string, unknown>,
): string {
  return toolResult({
    ok: true,
    action,
    semantic_memory_id: semanticMemoryId,
    fact_id: semanticMemoryId,
    ...extra,
  });
}

async function handleUpdateSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const semanticMemoryId = resolveSemanticMemoryId(args);
  if (!semanticMemoryId) return toolError("semantic_memory_id is required");

  const existing = await getSemanticMemoryStore().get(semanticMemoryId);
  if (!existing) return toolError(`Memory not found: ${semanticMemoryId}`);

  const patch: SemanticMemoryUpdateInput = { id: semanticMemoryId };
  if (args.content !== undefined) {
    const content = String(args.content).trim();
    if (!content) return toolError("content cannot be empty");
    patch.content = content;
  }
  if (args.type !== undefined) patch.type = String(args.type);
  if (args.pinned !== undefined) patch.pinned = Boolean(args.pinned);
  if (args.source_conversations !== undefined)
    patch.source_conversations = parseStringArray(args.source_conversations) ?? [];
  if (args.observed_at !== undefined) {
    patch.observed_at = args.observed_at === null ? null : String(args.observed_at);
  }
  if (args.occurred_at !== undefined) {
    patch.occurred_at = args.occurred_at === null ? null : String(args.occurred_at);
  }
  if (args.status !== undefined) patch.status = String(args.status);

  await getSemanticMemoryStore().update(patch);
  return toolResult({
    ok: true,
    id: semanticMemoryId,
    semantic_memory_id: semanticMemoryId,
    action: "update",
  });
}

async function handleDeprecateSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const semanticMemoryId = resolveSemanticMemoryId(args);
  if (!semanticMemoryId) return toolError("semantic_memory_id is required");
  const ok = await getSemanticMemoryStore().deprecate(semanticMemoryId);
  if (!ok) return toolError(`Memory not found: ${semanticMemoryId}`);
  return toolResult({
    ok: true,
    id: semanticMemoryId,
    semantic_memory_id: semanticMemoryId,
    action: "deprecate",
  });
}

async function handleSearchSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query ?? "").trim();
  const limit = Number(args.limit ?? 10);
  const types = parseStringArray(args.types);
  const sourceConversations = parseStringArray(args.source_conversations);
  const statusRaw = String(args.status ?? "active").trim();
  const status =
    statusRaw === "all" || statusRaw === "deprecated" || statusRaw === "active"
      ? statusRaw
      : "active";

  try {
    if (query) validateFtsQueryInput(query);

    const rows = await getSemanticMemoryStore().search({
      query: query || undefined,
      limit: Number.isFinite(limit) ? limit : 10,
      types,
      status,
      source_conversations: sourceConversations,
    });

    return toolResult({
      query: query || null,
      count: rows.length,
      results: rows.map((row) => ({
        id: row.id,
        semantic_memory_id: row.id,
        type: row.type,
        content: row.content,
        pinned: row.pinned,
        source_conversations: row.source_conversations,
        observed_at: row.observed_at,
        occurred_at: row.occurred_at,
        status: row.status,
      })),
    });
  } catch (e) {
    if (isFtsQueryError(e)) return toolError(formatFtsToolError(e));
    throw e;
  }
}

async function handleMergeSemanticMemories(args: Record<string, unknown>): Promise<string> {
  const sourceIds = parseStringArray(args.source_ids);
  if (!sourceIds || sourceIds.length === 0) {
    return toolError("source_ids is required (non-empty array)");
  }
  if (sourceIds.length === 1) {
    return toolError(
      "merge requires 2+ source_ids; use memory_semantic_update for single-memory edits",
    );
  }

  const targetContent = String(args.target_content ?? "").trim();
  if (!targetContent) return toolError("target_content is required");

  const store = getSemanticMemoryStore();

  // Look up all source memories
  const sources: {
    id: string;
    source_conversations: string[];
    observed_at: string | null;
    occurred_at: string | null;
  }[] = [];
  for (const id of sourceIds) {
    const row = await store.get(id);
    if (!row) continue;
    sources.push({
      id: row.id,
      source_conversations: row.source_conversations,
      observed_at: row.observed_at,
      occurred_at: row.occurred_at,
    });
  }

  if (sources.length === 0) return toolError("None of the source_ids found");
  if (sources.length === 1) {
    return toolError(
      `Only 1 of ${sourceIds.length} source_ids found; use memory_semantic_update instead`,
    );
  }

  // Union source_conversations (deduplicated)
  const mergedSessions = [...new Set(sources.flatMap((s) => s.source_conversations))];

  // Merge observed_at (earliest non-null)
  let earliestObserved: string | null = null;
  for (const s of sources) {
    if (!s.observed_at) continue;
    if (!earliestObserved || s.observed_at < earliestObserved) {
      earliestObserved = s.observed_at;
    }
  }

  // Merge occurred_at (earliest non-null string; fuzzy times approximated lexicographically)
  let earliestOccurred: string | null = null;
  for (const s of sources) {
    const raw = s.occurred_at?.trim();
    if (!raw) continue;
    if (!earliestOccurred || raw < earliestOccurred) {
      earliestOccurred = raw;
    }
  }

  const mergedOccurred =
    args.target_occurred_at !== undefined && args.target_occurred_at !== null
      ? String(args.target_occurred_at)
      : (earliestOccurred ?? undefined);

  // Create new memory
  const newId = await store.create({
    content: targetContent,
    type: args.target_type !== undefined ? String(args.target_type) : undefined,
    pinned: args.target_pinned !== undefined ? Boolean(args.target_pinned) : undefined,
    source_conversations: mergedSessions,
    observed_at: earliestObserved,
    occurred_at: mergedOccurred,
    status: "active",
  });

  // Deprecate all source memories
  const deprecatedIds: string[] = [];
  for (const s of sources) {
    const ok = await store.deprecate(s.id);
    if (ok) deprecatedIds.push(s.id);
  }

  return toolResult({
    ok: true,
    id: newId,
    action: "merge",
    deprecated_ids: deprecatedIds,
    merged_source_conversations: mergedSessions,
    merged_observed_at: earliestObserved,
    merged_occurred_at: mergedOccurred ?? null,
  });
}

function resolveObservedAt(
  args: Record<string, unknown>,
  defaults?: { observed_at?: string },
): string {
  if (args.observed_at !== undefined && args.observed_at !== null) {
    return String(args.observed_at);
  }
  return defaults?.observed_at ?? formatCstIso();
}

/** Shared create logic for remember and light sleep */
export async function createSemanticMemoryFromArgs(
  args: Record<string, unknown>,
  defaults?: { source_conversations?: string[]; observed_at?: string },
): Promise<string> {
  const content = String(args.content ?? "").trim();
  if (!content) throw new Error("content is required");

  const sourceConversations =
    args.source_conversations !== undefined
      ? (parseStringArray(args.source_conversations) ?? [])
      : (defaults?.source_conversations ?? []);

  return getSemanticMemoryStore().create({
    content,
    type: args.type !== undefined ? String(args.type) : undefined,
    pinned: args.pinned !== undefined ? Boolean(args.pinned) : undefined,
    source_conversations: sourceConversations,
    observed_at: resolveObservedAt(args, defaults),
    occurred_at:
      args.occurred_at !== undefined && args.occurred_at !== null
        ? String(args.occurred_at)
        : undefined,
  });
}

export const semanticMemoryToolDefs: ToolDef[] = [
  {
    name: "memory_semantic_create",
    description:
      "Explicitly create a semantic memory. Requires content; optional type/pinned/source_conversations/observed_at/occurred_at.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Memory body (one concise sentence)" },
        type: { type: "string", enum: [...MEMORY_TYPES], description: "Memory type" },
        pinned: { type: "boolean", description: "Pin to resident context" },
        source_conversations: {
          type: "array",
          items: { type: "string" },
          description: "Source conversation ID list",
        },
        observed_at: { type: "string", description: "First observed time (ISO8601)" },
        occurred_at: { type: "string", description: "Fuzzy occurrence time described in content" },
      },
      required: ["content"],
    },
    handler: handleCreateSemanticMemory,
  },
  {
    name: "memory_semantic_update",
    description:
      "Overwrite-update semantic memory: only passed fields change; omitted fields stay as-is. Pass source_conversations=[] to clear sources.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Memory ID" },
        content: { type: "string", description: "New memory body" },
        type: { type: "string", enum: [...MEMORY_TYPES], description: "Memory type" },
        pinned: { type: "boolean", description: "Whether pinned" },
        source_conversations: {
          type: "array",
          items: { type: "string" },
          description: "Source conversation ID list; pass [] to clear",
        },
        observed_at: {
          type: "string",
          description: "First observed time (ISO8601); pass null to clear",
        },
        occurred_at: { type: "string", description: "Fuzzy occurrence time; pass null to clear" },
        status: { type: "string", enum: ["active", "deprecated"], description: "Memory status" },
      },
      required: ["id"],
    },
    handler: handleUpdateSemanticMemory,
  },
  {
    name: "memory_semantic_deprecate",
    description: "Soft-deprecate a semantic memory (status=deprecated, history retained).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Memory ID" },
      },
      required: ["id"],
    },
    handler: handleDeprecateSemanticMemory,
  },
  {
    name: "memory_semantic_search",
    description:
      "Structured semantic memory search: FTS query plus type/status/source_conversations filters. Returns active by default.\n\n" +
      MEMORY_SEMANTIC_CITATION_TOOL_HINT,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Full-text keywords (optional)" },
        limit: { type: "number", description: "Max results, default 10" },
        types: {
          type: "array",
          items: { type: "string", enum: [...MEMORY_TYPES] },
          description: "Restrict memory types",
        },
        status: {
          type: "string",
          enum: ["active", "deprecated", "all"],
          description: "Status filter, default active",
        },
        source_conversations: {
          type: "array",
          items: { type: "string" },
          description: "Memories intersecting given conversation list",
        },
      },
      required: [],
    },
    handler: handleSearchSemanticMemory,
  },
  {
    name: "memory_semantic_merge",
    description:
      "Merge multiple semantic memories into one. Program unions source_conversations and takes earliest observed_at and occurred_at. Requires 2+ source_ids and target_content. Source memories are auto-deprecated after merge.",
    parameters: {
      type: "object",
      properties: {
        source_ids: {
          type: "array",
          items: { type: "string" },
          description: "Source memory IDs to merge (at least 2)",
        },
        target_content: { type: "string", description: "Merged memory body" },
        target_type: { type: "string", enum: [...MEMORY_TYPES], description: "Merged memory type" },
        target_pinned: { type: "boolean", description: "Whether pinned" },
        target_occurred_at: { type: "string", description: "Fuzzy occurrence time" },
      },
      required: ["source_ids", "target_content"],
    },
    handler: handleMergeSemanticMemories,
  },
];

export async function rememberFromArgs(args: Record<string, unknown>): Promise<string> {
  const action = String(args.action ?? "create").trim() || "create";
  const store = getSemanticMemoryStore();

  if (action === "delete") {
    const semanticMemoryId = resolveSemanticMemoryId(args);
    if (!semanticMemoryId) return toolError("semantic_memory_id is required for delete");
    const deleted = await store.delete(semanticMemoryId);
    return rememberResult("delete", semanticMemoryId, { ok: deleted });
  }

  if (action === "update") {
    const semanticMemoryId = resolveSemanticMemoryId(args);
    if (!semanticMemoryId) return toolError("semantic_memory_id is required for update");
    return handleUpdateSemanticMemory({ ...args, id: semanticMemoryId });
  }

  const conversationId = getToolConversationIdForMemory();
  const semanticMemoryId = await createSemanticMemoryFromArgs(args, {
    source_conversations: conversationId ? [conversationId] : [],
  });
  return rememberResult("create", semanticMemoryId);
}
