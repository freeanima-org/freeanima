import {
  autobiographicalMemoryListBodySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  type AutobiographicalMemoryListBody,
  type LimbicMemoryListBody,
  type MemorySearchBody,
  type SemanticMemoryListBody,
} from "@freeanima/connectors-webui/api";
import type { AnimaService } from "@freeanima/service-api";
import { webuiCtx } from "./runtime.ts";

export function createMemoryHandlers(service: AnimaService) {
  return {
    listMemoryFiles: () => service.listMemoryFiles(),
    memorySearch: (body: MemorySearchBody) => {
      const parsed = memorySearchBodySchema.parse(body);
      return service.memorySearch({
        query: parsed.query,
        limit: parsed.limit,
      });
    },
    countSemanticMemory: async () => {
      const { index_rows } = await service.countSemanticMemory();
      return {
        ok: true as const,
        index_rows,
        code: "semantic_memory_count" as const,
        params: { count: String(index_rows) },
      };
    },
    listSemanticMemories: (body: SemanticMemoryListBody) => {
      const parsed = semanticMemoryListBodySchema.parse(body);
      return service.listSemanticMemories({
        query: parsed.query?.trim() || undefined,
        offset: parsed.offset,
        limit: parsed.limit,
        types: parsed.types,
        status: parsed.status,
        source_session: parsed.source_session?.trim() || undefined,
      });
    },
    listLimbicMemories: (body: LimbicMemoryListBody) => {
      const parsed = limbicMemoryListBodySchema.parse(body);
      return service.listLimbicMemories({
        query: parsed.query?.trim() || undefined,
        offset: parsed.offset,
        limit: parsed.limit,
        session_id: parsed.session_id?.trim() || undefined,
        kind: parsed.kind,
      });
    },
    listAutobiographicalMemories: (body: AutobiographicalMemoryListBody) => {
      const parsed = autobiographicalMemoryListBodySchema.parse(body);
      return service.listAutobiographicalMemories({
        query: parsed.query?.trim() || undefined,
        offset: parsed.offset,
        limit: parsed.limit,
        status: parsed.status,
        significance: parsed.significance,
        source_session: parsed.source_session?.trim() || undefined,
      });
    },
  };
}

type MemoryHandlers = ReturnType<typeof createMemoryHandlers>;

let handlers: MemoryHandlers | null = null;

function memoryHandlers(): MemoryHandlers {
  if (!handlers) {
    handlers = createMemoryHandlers(webuiCtx().service);
  }
  return handlers;
}

export async function listMemoryFiles() {
  return memoryHandlers().listMemoryFiles();
}

export async function memorySearch(body: MemorySearchBody) {
  return memoryHandlers().memorySearch(body);
}

export async function countSemanticMemory() {
  return memoryHandlers().countSemanticMemory();
}

export async function listSemanticMemories(body: SemanticMemoryListBody) {
  return memoryHandlers().listSemanticMemories(body);
}

export async function listLimbicMemories(body: LimbicMemoryListBody) {
  return memoryHandlers().listLimbicMemories(body);
}

export async function listAutobiographicalMemories(body: AutobiographicalMemoryListBody) {
  return memoryHandlers().listAutobiographicalMemories(body);
}

/** 单测 / 显式注入后重置懒加载缓存 */
export function resetMemoryHandlersForTests(): void {
  handlers = null;
}
