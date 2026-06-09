import type { ToolDef } from "@freeanima/engine-tool";
import { toolError, toolResult } from "@freeanima/engine-tool";
import { formatCstIso } from "@freeanima/kernel-util";
import type { SemanticMemoryCreateInput, SemanticMemoryUpdateInput } from "@freeanima/engine-repos";

import { getSemanticMemoryStore } from "./semantic-port.ts";
import { getToolSessionIdForMemory } from "./tool-session-port.ts";

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
    source_sessions: parseStringArray(args.source_sessions),
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
  if (args.source_sessions !== undefined)
    patch.source_sessions = parseStringArray(args.source_sessions) ?? [];
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
  const sourceSessions = parseStringArray(args.source_sessions);
  const statusRaw = String(args.status ?? "active").trim();
  const status =
    statusRaw === "all" || statusRaw === "deprecated" || statusRaw === "active"
      ? statusRaw
      : "active";

  const rows = await getSemanticMemoryStore().search({
    query: query || undefined,
    limit: Number.isFinite(limit) ? limit : 10,
    types,
    status,
    source_sessions: sourceSessions,
  });

  return toolResult({
    query: query || null,
    count: rows.length,
    results: rows.map((row) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      pinned: row.pinned,
      source_sessions: row.source_sessions,
      observed_at: row.observed_at,
      occurred_at: row.occurred_at,
      status: row.status,
    })),
  });
}

async function handleMergeSemanticMemories(args: Record<string, unknown>): Promise<string> {
  const sourceIds = parseStringArray(args.source_ids);
  if (!sourceIds || sourceIds.length === 0) {
    return toolError("source_ids is required (non-empty array)");
  }
  if (sourceIds.length === 1) {
    return toolError(
      "merge requires 2+ source_ids; use update_semantic_memory for single-memory edits",
    );
  }

  const targetContent = String(args.target_content ?? "").trim();
  if (!targetContent) return toolError("target_content is required");

  const store = getSemanticMemoryStore();

  // 查找所有源记忆
  const sources: { id: string; source_sessions: string[]; observed_at: string | null }[] = [];
  for (const id of sourceIds) {
    const row = await store.get(id);
    if (!row) continue;
    sources.push({
      id: row.id,
      source_sessions: row.source_sessions,
      observed_at: row.observed_at,
    });
  }

  if (sources.length === 0) return toolError("None of the source_ids found");
  if (sources.length === 1) {
    return toolError(
      `Only 1 of ${sourceIds.length} source_ids found; use update_semantic_memory instead`,
    );
  }

  // 合并 source_sessions（并集去重）
  const mergedSessions = [...new Set(sources.flatMap((s) => s.source_sessions))];

  // 合并 observed_at（取最早非空）
  let earliestObserved: string | null = null;
  for (const s of sources) {
    if (!s.observed_at) continue;
    if (!earliestObserved || s.observed_at < earliestObserved) {
      earliestObserved = s.observed_at;
    }
  }

  // 创建新记忆
  const newId = await store.create({
    content: targetContent,
    type: args.target_type !== undefined ? String(args.target_type) : undefined,
    pinned: args.target_pinned !== undefined ? Boolean(args.target_pinned) : undefined,
    source_sessions: mergedSessions,
    observed_at: earliestObserved,
    occurred_at:
      args.target_occurred_at !== undefined && args.target_occurred_at !== null
        ? String(args.target_occurred_at)
        : undefined,
    status: "active",
  });

  // 废弃所有源记忆
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
    merged_source_sessions: mergedSessions,
    merged_observed_at: earliestObserved,
  });
}

/** 供 remember 与浅睡共用的创建逻辑 */
export async function createSemanticMemoryFromArgs(
  args: Record<string, unknown>,
  defaults?: { source_sessions?: string[]; observed_at?: string },
): Promise<string> {
  const content = String(args.content ?? "").trim();
  if (!content) throw new Error("content is required");

  const sourceSessions =
    args.source_sessions !== undefined
      ? (parseStringArray(args.source_sessions) ?? [])
      : (defaults?.source_sessions ?? []);

  return getSemanticMemoryStore().create({
    content,
    type: args.type !== undefined ? String(args.type) : undefined,
    pinned: args.pinned !== undefined ? Boolean(args.pinned) : undefined,
    source_sessions: sourceSessions,
    observed_at: defaults?.observed_at ?? formatCstIso(),
    occurred_at:
      args.occurred_at !== undefined && args.occurred_at !== null
        ? String(args.occurred_at)
        : undefined,
  });
}

export const semanticMemoryToolDefs: ToolDef[] = [
  {
    name: "create_semantic_memory",
    description:
      "显式创建一条语义记忆。需提供 content；可选 type/pinned/source_sessions/observed_at/occurred_at。",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "记忆正文（一句话精炼描述）" },
        type: { type: "string", enum: [...MEMORY_TYPES], description: "记忆类型" },
        pinned: { type: "boolean", description: "是否置顶到常驻记忆" },
        source_sessions: {
          type: "array",
          items: { type: "string" },
          description: "来源 session ID 列表",
        },
        observed_at: { type: "string", description: "首次观察到该事实的时间（ISO8601）" },
        occurred_at: { type: "string", description: "事实内容中描述的模糊发生时间" },
      },
      required: ["content"],
    },
    handler: handleCreateSemanticMemory,
  },
  {
    name: "update_semantic_memory",
    description:
      "覆盖式更新语义记忆：仅修改传入的字段，未传字段保持不变。传 source_sessions=[] 可清空来源列表。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "记忆 ID" },
        content: { type: "string", description: "新的记忆正文" },
        type: { type: "string", enum: [...MEMORY_TYPES], description: "记忆类型" },
        pinned: { type: "boolean", description: "是否置顶" },
        source_sessions: {
          type: "array",
          items: { type: "string" },
          description: "来源 session ID 列表；传 [] 清空",
        },
        observed_at: { type: "string", description: "首次观察时间（ISO8601）；传 null 清空" },
        occurred_at: { type: "string", description: "模糊发生时间；传 null 清空" },
        status: { type: "string", enum: ["active", "deprecated"], description: "记忆状态" },
      },
      required: ["id"],
    },
    handler: handleUpdateSemanticMemory,
  },
  {
    name: "deprecate_semantic_memory",
    description: "软废弃一条语义记忆（status=deprecated，保留历史）。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "记忆 ID" },
      },
      required: ["id"],
    },
    handler: handleDeprecateSemanticMemory,
  },
  {
    name: "search_semantic_memory",
    description:
      "结构化搜索语义记忆：支持 FTS query、type/status/source_sessions 过滤。默认仅返回 active。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "全文检索关键词（可选）" },
        limit: { type: "number", description: "最多返回条数，默认 10" },
        types: {
          type: "array",
          items: { type: "string", enum: [...MEMORY_TYPES] },
          description: "限定记忆类型",
        },
        status: {
          type: "string",
          enum: ["active", "deprecated", "all"],
          description: "记忆状态过滤，默认 active",
        },
        source_sessions: {
          type: "array",
          items: { type: "string" },
          description: "与给定 session 列表有交集的记忆",
        },
      },
      required: [],
    },
    handler: handleSearchSemanticMemory,
  },
  {
    name: "merge_semantic_memories",
    description:
      "合并多条语义记忆为一条。程序自动处理 source_sessions 并集和 observed_at 取最早。需 2+ 条 source_ids 和 target_content。合并后自动废弃源记忆。",
    parameters: {
      type: "object",
      properties: {
        source_ids: {
          type: "array",
          items: { type: "string" },
          description: "待合并的源记忆 ID（至少 2 条）",
        },
        target_content: { type: "string", description: "合并后的新记忆正文" },
        target_type: { type: "string", enum: [...MEMORY_TYPES], description: "合并后的记忆类型" },
        target_pinned: { type: "boolean", description: "是否置顶" },
        target_occurred_at: { type: "string", description: "事实发生的模糊时间" },
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

  const sessionId = getToolSessionIdForMemory();
  const semanticMemoryId = await createSemanticMemoryFromArgs(args, {
    source_sessions: sessionId ? [sessionId] : [],
    observed_at: formatCstIso(),
  });
  return rememberResult("create", semanticMemoryId);
}
