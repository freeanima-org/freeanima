import { registerTool } from "@freeanima/engine-tool";
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

function jsonResult(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

function jsonError(message: string): string {
  return JSON.stringify({ error: message });
}

async function handleCreateSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const content = String(args.content ?? "").trim();
  if (!content) return jsonError("content is required");

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
  return jsonResult({ ok: true, id, action: "create" });
}

async function handleUpdateSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const id = String(args.id ?? args.fact_id ?? "").trim();
  if (!id) return jsonError("id is required");

  const existing = await getSemanticMemoryStore().get(id);
  if (!existing) return jsonError(`Memory not found: ${id}`);

  const patch: SemanticMemoryUpdateInput = { id };
  if (args.content !== undefined) {
    const content = String(args.content).trim();
    if (!content) return jsonError("content cannot be empty");
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
  return jsonResult({ ok: true, id, action: "update" });
}

async function handleDeprecateSemanticMemory(args: Record<string, unknown>): Promise<string> {
  const id = String(args.id ?? args.fact_id ?? "").trim();
  if (!id) return jsonError("id is required");
  const ok = await getSemanticMemoryStore().deprecate(id);
  if (!ok) return jsonError(`Memory not found: ${id}`);
  return jsonResult({ ok: true, id, action: "deprecate" });
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

  if (!rows.length) {
    return query ? `未找到与「${query}」匹配的语义记忆。` : "未找到匹配的语义记忆。";
  }

  const lines = [`找到 ${rows.length} 条语义记忆：`];
  for (const row of rows) {
    const pinned = row.pinned ? "📌" : "";
    const sources =
      row.source_sessions.length > 0 ? ` sources=[${row.source_sessions.join(", ")}]` : "";
    lines.push(`  [${row.id}] (${row.type})${pinned}${sources} ${row.content}`);
  }
  return lines.join("\n");
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

export function registerSemanticMemoryTools(): void {
  registerTool({
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
  });

  registerTool({
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
  });

  registerTool({
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
  });

  registerTool({
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
  });
}

export async function rememberFromArgs(args: Record<string, unknown>): Promise<string> {
  const action = String(args.action ?? "create").trim() || "create";
  const store = getSemanticMemoryStore();

  if (action === "delete") {
    const factId = String(args.fact_id ?? "").trim();
    if (!factId) return jsonError("fact_id is required for delete");
    const deleted = await store.delete(factId);
    return jsonResult({ ok: deleted, fact_id: factId, action: "delete" });
  }

  if (action === "update") {
    const factId = String(args.fact_id ?? "").trim();
    if (!factId) return jsonError("fact_id is required for update");
    return handleUpdateSemanticMemory({ ...args, id: factId });
  }

  const sessionId = getToolSessionIdForMemory();
  const factId = await createSemanticMemoryFromArgs(args, {
    source_sessions: sessionId ? [sessionId] : [],
    observed_at: formatCstIso(),
  });
  return jsonResult({ ok: true, fact_id: factId, action: "create" });
}
