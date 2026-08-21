import {
  createSemanticMemory,
  deprecateSemanticMemory,
  getSemanticMemory,
  listActiveSemanticMemory,
  listResidentSemanticMemory,
  updateSemanticMemory,
} from "@freeanima/habitat/core/db/pg/semantic-memory";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/pg/semantic-memory/types";
import { getMessageTextItemsByIds } from "@freeanima/habitat/core/db/pg/conversation";
import {
  PROMPT_XML_TAGS,
  RESIDENT_MEMORY_FIELDS,
  renderSemanticMemoryItem,
  toSemanticMemoryPromptItem,
  wrapPromptXmlSection,
} from "@freeanima/habitat/core/hooks/prompt";
import { formatCstIso, omitUndefined } from "@freeanima/habitat/core/util";
import { RESIDENT_MEMORY_SYSTEM_FRAME } from "../system-prompt.ts";
import { bumpReferenceCountsFromTexts } from "./cite.ts";
import type { MemoryService } from "./memory-service.ts";
import { defaultReflect } from "./reflect.ts";
import { runBuiltinRetain } from "./builtin-retain.ts";
import { isRetainLlmRegistered } from "./retain-llm-port.ts";
import { tryGetRetainEngine } from "./retain-engine-port.ts";
import { createRetainWatermarkStore, type RetainWatermarkStore } from "./retain-watermark.ts";
import type {
  CiteInput,
  CiteResult,
  ListMemoryInput,
  MemoryProvenance,
  MemoryRecord,
  MemoryRecordStatus,
  RememberInput,
  RetainInput,
  RetainResult,
  SyncTurnInput,
  SyncTurnResult,
  UpdateMemoryInput,
} from "./types.ts";

function toStatus(raw: string | undefined | null): MemoryRecordStatus {
  return raw === "deprecated" ? "deprecated" : "active";
}

function asTemporalBucket(window: string | undefined): "day" | "month" | "year" {
  if (window === "month" || window === "year") return window;
  return "day";
}

/** 旧 source_conversations → 最小 provenance（缺 message 窗时仅 conversation_id） */
export function provenanceFromSourceConversations(
  conversations: string[] | undefined,
): MemoryProvenance | null {
  const id = conversations?.find((c) => c.trim())?.trim();
  if (!id) return null;
  return { conversation_id: id };
}

export function semanticRowToMemoryRecord(row: SemanticMemoryRow): MemoryRecord {
  return {
    id: row.id,
    content: row.content,
    kind: row.type,
    status: toStatus(row.status),
    pinned: row.pinned,
    reference_count: row.reference_count,
    source: row.source ?? provenanceFromSourceConversations(row.source_conversations),
    links: row.links ?? [],
    source_conversations: row.source_conversations,
    observed_at: row.observed_at,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    world_id: row.world_id,
  };
}

function requireProvenance(
  source: MemoryProvenance | null | undefined,
  ctx: string,
): MemoryProvenance {
  const cid = source?.conversation_id?.trim();
  if (!cid) {
    throw new Error(`${ctx}: source.conversation_id is required (provenance)`);
  }
  return omitUndefined({
    conversation_id: cid,
    message_id_from: source?.message_id_from,
    message_id_to: source?.message_id_to,
    message_ids: source?.message_ids,
  });
}

function resolveRetainMessageIds(input: RetainInput): string[] {
  if (input.message_ids?.length)
    return [...new Set(input.message_ids.map((id) => id.trim()).filter(Boolean))];
  const ids: string[] = [];
  if (input.message_id_from?.trim()) ids.push(input.message_id_from.trim());
  if (input.message_id_to?.trim() && input.message_id_to !== input.message_id_from) {
    ids.push(input.message_id_to.trim());
  }
  return ids;
}

export type CreateEmbeddedMemoryServiceOpts = {
  deps?: {
    getSemanticMemory?: typeof getSemanticMemory;
    listActiveSemanticMemory?: typeof listActiveSemanticMemory;
    listResidentSemanticMemory?: typeof listResidentSemanticMemory;
    updateSemanticMemory?: typeof updateSemanticMemory;
    createSemanticMemory?: typeof createSemanticMemory;
    deprecateSemanticMemory?: typeof deprecateSemanticMemory;
    getMessageTextItemsByIds?: typeof getMessageTextItemsByIds;
    bumpReferenceCountsFromTexts?: typeof bumpReferenceCountsFromTexts;
    watermarkStore?: RetainWatermarkStore;
  };
};

/**
 * embedded MemoryService（#16102）。
 * retain 与 retain 热路径并行；未注册 RetainEngine 时仍前进 watermark。
 */
export function createEmbeddedMemoryService(
  opts: CreateEmbeddedMemoryServiceOpts = {},
): MemoryService {
  const deps = {
    getSemanticMemory: opts.deps?.getSemanticMemory ?? getSemanticMemory,
    listActiveSemanticMemory: opts.deps?.listActiveSemanticMemory ?? listActiveSemanticMemory,
    listResidentSemanticMemory: opts.deps?.listResidentSemanticMemory ?? listResidentSemanticMemory,
    updateSemanticMemory: opts.deps?.updateSemanticMemory ?? updateSemanticMemory,
    createSemanticMemory: opts.deps?.createSemanticMemory ?? createSemanticMemory,
    deprecateSemanticMemory: opts.deps?.deprecateSemanticMemory ?? deprecateSemanticMemory,
    getMessageTextItemsByIds: opts.deps?.getMessageTextItemsByIds ?? getMessageTextItemsByIds,
    bumpReferenceCountsFromTexts:
      opts.deps?.bumpReferenceCountsFromTexts ?? bumpReferenceCountsFromTexts,
    watermarkStore: opts.deps?.watermarkStore ?? createRetainWatermarkStore(),
  };

  const service: MemoryService = {
    deployment: "embedded",

    recall: async (input) => {
      if (input.scope === "temporal") {
        const rows = await service.temporal.list({ limit: input.limit ?? 10 });
        const q = input.query.trim().toLowerCase();
        const hits = rows
          .filter((r) => !q || r.summary.toLowerCase().includes(q) || r.key.includes(q))
          .slice(0, input.limit ?? 10)
          .map((r, i) => ({
            id: r.id,
            score: 1 / (i + 1),
            scope: "temporal" as const,
            content: r.summary,
          }));
        return { hits };
      }
      const { searchSemanticMemory: searchSem } = await import("../search.ts");
      const results = await searchSem(input.query, input.limit ?? 10);
      return {
        hits: results.map((r) =>
          omitUndefined({
            id: Number(r.metadata.id),
            score: r.score,
            scope: "semantic" as const,
            content: r.content,
            kind: typeof r.metadata.type === "string" ? r.metadata.type : undefined,
          }),
        ),
      };
    },

    search: async (input) => {
      const query = input ?? {};
      if (query.query?.trim()) {
        const recalled = await service.recall({
          query: query.query,
          scope: query.scope ?? "semantic",
          limit: query.limit ?? 20,
        });
        const records: MemoryRecord[] = [];
        for (const hit of recalled.hits) {
          const rec = await service.get(hit.id);
          if (rec) records.push(rec);
        }
        return records;
      }
      return service.list(
        omitUndefined({
          kinds: query.kinds,
          status: query.status,
          limit: query.limit,
          offset: query.offset,
        }),
      );
    },

    async cite(input: CiteInput): Promise<CiteResult> {
      const cited_ids = await deps.bumpReferenceCountsFromTexts(input.texts ?? []);
      return { cited_ids };
    },

    async remember(input: RememberInput): Promise<MemoryRecord> {
      const source = requireProvenance(input.source, "remember");
      const id = await deps.createSemanticMemory(
        omitUndefined({
          content: input.content,
          type: input.kind,
          pinned: input.pinned,
          source,
          links: input.links ?? [],
          source_conversations: [source.conversation_id],
          observed_at: input.observed_at,
          occurred_at: input.occurred_at,
        }),
      );
      const row = await deps.getSemanticMemory(id);
      if (!row) throw new Error(`remember: created memory ${id} not readable`);
      return semanticRowToMemoryRecord(row);
    },

    async update(input: UpdateMemoryInput): Promise<MemoryRecord> {
      await deps.updateSemanticMemory(
        omitUndefined({
          id: input.id,
          content: input.content,
          type: input.kind,
          pinned: input.pinned,
          status: input.status,
          source: input.source ?? undefined,
          links: input.links,
          observed_at: input.observed_at,
          occurred_at: input.occurred_at,
        }),
      );
      const row = await deps.getSemanticMemory(input.id);
      if (!row) throw new Error(`update: memory ${input.id} not found`);
      return semanticRowToMemoryRecord(row);
    },

    async deprecate(id: number): Promise<void> {
      const ok = await deps.deprecateSemanticMemory(id);
      if (!ok) throw new Error(`deprecate: memory ${id} not found`);
    },

    async retain(input: RetainInput): Promise<RetainResult> {
      const conversation_id = input.conversation_id?.trim();
      if (!conversation_id) {
        throw new Error("retain: conversation_id is required (provenance)");
      }
      const message_ids = resolveRetainMessageIds(input);
      const tipId = message_ids[message_ids.length - 1];

      if (tipId && !input.force) {
        const wm = await deps.watermarkStore.get(conversation_id);
        if (wm?.message_id === tipId) {
          return { created: [], updated: [], skipped: true };
        }
      }

      const textItems =
        message_ids.length > 0
          ? await deps.getMessageTextItemsByIds(conversation_id, message_ids)
          : [];
      const texts = textItems.map((i) => i.content);

      const source: MemoryProvenance = omitUndefined({
        conversation_id,
        message_id_from: message_ids[0],
        message_id_to: tipId,
        message_ids: message_ids.length > 0 ? message_ids : undefined,
      });

      // 测试可注入 item 引擎；生产走内建 retain LLM
      const testEngine = tryGetRetainEngine();
      if (testEngine) {
        const engineResult = await testEngine({ conversation_id, message_ids, texts });
        const created: number[] = [];
        const updated: number[] = [];
        for (const item of engineResult.items) {
          const action = item.action ?? "create";
          if (action === "create") {
            const rec = await service.remember(
              omitUndefined({
                content: item.content,
                kind: item.kind,
                source,
              }),
            );
            created.push(rec.id);
          } else if (action === "update" && item.id != null) {
            await service.update(
              omitUndefined({
                id: item.id,
                content: item.content,
                kind: item.kind,
                source,
              }),
            );
            updated.push(item.id);
          } else if (action === "deprecate" && item.id != null) {
            await service.deprecate(item.id);
            updated.push(item.id);
          }
        }
        if (tipId) {
          await deps.watermarkStore.set(conversation_id, {
            message_id: tipId,
            at: formatCstIso(),
          });
        }
        return { created, updated, skipped: false };
      }

      const builtin = await runBuiltinRetain({
        conversation_id,
        message_ids,
        texts,
        text_items: textItems.map((i) =>
          omitUndefined({ role: i.role, content: i.content, t: i.timestamp }),
        ),
        source,
      });

      if (tipId) {
        await deps.watermarkStore.set(conversation_id, {
          message_id: tipId,
          at: formatCstIso(),
        });
      }

      return {
        created: builtin.created,
        updated: builtin.updated,
        skipped: builtin.skipped && !isRetainLlmRegistered(),
      };
    },

    async syncTurn(input: SyncTurnInput): Promise<SyncTurnResult> {
      const texts = input.texts ?? [];
      const citeResult =
        texts.length > 0
          ? await service.cite({ texts, conversation_id: input.conversation_id })
          : { cited_ids: [] };

      const trigger = input.trigger_retain !== false;
      let retain_scheduled = false;
      if (trigger && input.conversation_id.trim()) {
        retain_scheduled = true;
        void service
          .retain(
            omitUndefined({
              conversation_id: input.conversation_id,
              message_ids: input.message_ids,
              message_id_from: input.message_ids[0],
              message_id_to: input.message_ids[input.message_ids.length - 1],
            }),
          )
          .catch(() => {
            /* 异步 retain 失败由调用方日志覆盖；syncTurn 不抛 */
          });
      }

      return { cited_ids: citeResult.cited_ids, retain_scheduled };
    },

    async reflect(input) {
      return defaultReflect(input);
    },

    async get(id: number): Promise<MemoryRecord | null> {
      const row = await deps.getSemanticMemory(id);
      return row ? semanticRowToMemoryRecord(row) : null;
    },

    async list(input: ListMemoryInput = {}): Promise<MemoryRecord[]> {
      let rows = await deps.listActiveSemanticMemory();
      if (input.status === "deprecated") {
        rows = rows.filter((r) => r.status === "deprecated");
      } else if (input.status !== "all") {
        rows = rows.filter((r) => r.status !== "deprecated");
      }
      if (input.kinds?.length) {
        const set = new Set(input.kinds);
        rows = rows.filter((r) => set.has(r.type));
      }
      if (input.pinned === true) rows = rows.filter((r) => r.pinned);
      if (input.pinned === false) rows = rows.filter((r) => !r.pinned);
      const offset = input.offset ?? 0;
      const limit = input.limit ?? rows.length;
      return rows.slice(offset, offset + limit).map(semanticRowToMemoryRecord);
    },

    async pin(id: number): Promise<void> {
      await deps.updateSemanticMemory({ id, pinned: true });
    },

    async unpin(id: number): Promise<void> {
      await deps.updateSemanticMemory({ id, pinned: false });
    },

    async listResident(residentOpts?: { topN?: number }): Promise<MemoryRecord[]> {
      const rows = await deps.listResidentSemanticMemory(residentOpts?.topN);
      return rows.map(semanticRowToMemoryRecord);
    },

    async assembleResidentBlock(residentOpts?: { topN?: number }): Promise<string> {
      const records = await service.listResident(residentOpts);
      if (records.length === 0) return "";
      const body = records
        .map((r) =>
          renderSemanticMemoryItem(toSemanticMemoryPromptItem(r), {
            fields: RESIDENT_MEMORY_FIELDS,
          }),
        )
        .filter(Boolean)
        .join("\n");
      return wrapPromptXmlSection(PROMPT_XML_TAGS.residentMemory, body, {
        frame: RESIDENT_MEMORY_SYSTEM_FRAME,
      });
    },

    temporal: {
      async list(input = {}) {
        const { listTemporalSummaries } =
          await import("@freeanima/habitat/core/db/pg/temporal-summary");
        const { resolveToolCallerAgentWorldId } = await import("../tool-agent-world.ts");
        const { agent_world_id } = await resolveToolCallerAgentWorldId();
        const window =
          input.bucket === "month"
            ? ("month" as const)
            : input.bucket === "year"
              ? ("year" as const)
              : ("day" as const);
        const { items } = await listTemporalSummaries(
          omitUndefined({
            window,
            offset: input.offset,
            limit: input.limit ?? 50,
            world_id: agent_world_id,
          }),
        );
        return items.map((r) => ({
          id: r.id,
          bucket: asTemporalBucket(r.window),
          key: r.period_start,
          summary: r.content,
        }));
      },
      async get(input) {
        if (input.id != null) {
          const { getEntity } = await import("@freeanima/habitat/core/db/pg/entity");
          const row = await getEntity(input.id);
          if (!row || row.primary_component !== "temporal_summary") return null;
          const body = row.body as { window?: string; period_start?: string };
          return {
            id: row.id,
            bucket: asTemporalBucket(body.window),
            key: body.period_start ?? "",
            summary: row.content ?? "",
          };
        }
        if (input.bucket && input.key) {
          const { getTemporalSummary } =
            await import("@freeanima/habitat/core/db/pg/temporal-summary");
          const { resolveToolCallerAgentWorldId } = await import("../tool-agent-world.ts");
          const { agent_world_id } = await resolveToolCallerAgentWorldId();
          const row = await getTemporalSummary(input.bucket, input.key, {
            world_id: agent_world_id,
          });
          if (!row) return null;
          return {
            id: row.id,
            bucket: input.bucket,
            key: row.period_start,
            summary: row.content,
          };
        }
        return null;
      },
      async regenerate(input) {
        const { resolveTemporalSummaryConfig, rebuildMonthSummary, rebuildYearSummary } =
          await import("../temporal-summary/index.ts");
        const { getActiveRuntimeConfig } = await import("@freeanima/habitat/core/config");
        const { listEnabledBoundAgents } =
          await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
        const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
        const agents = await listEnabledBoundAgents();
        for (const agent of agents) {
          if (input.bucket === "month") {
            await rebuildMonthSummary({
              period_start: input.key,
              config,
              agent_subject_id: agent.agent_subject_id,
              world_id: agent.agent_world_id,
            });
          } else if (input.bucket === "year") {
            await rebuildYearSummary({
              period_start: input.key,
              config,
              agent_subject_id: agent.agent_subject_id,
              world_id: agent.agent_world_id,
            });
          }
        }
        return (
          (await service.temporal.get({ bucket: input.bucket, key: input.key })) ?? {
            id: 0,
            bucket: input.bucket,
            key: input.key,
            summary: "",
          }
        );
      },
    },
  };

  return service;
}
