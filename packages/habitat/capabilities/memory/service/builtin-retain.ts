/**
 * 内建 retain：浅睡语义抽取迁入 MemoryService（#16102）。
 * LLM 仅经 retain-llm-port；未注册 LLM 时跳过抽取（仍由调用方推进 watermark）。
 */

import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { listSemanticMemoryBySourceSessions } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { updateSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { getActiveRuntimeConfig, resolvePassiveRecallConfig } from "@freeanima/habitat/core/config";

import { RETAIN_TASK_SPEC, formatExistingMemoriesMessage } from "../day-window/build-messages.ts";
import { formatPassiveMemoryBlock } from "../passive-recall/inject.ts";

import { withRetainProvenance } from "./retain-context.ts";
import { isRetainLlmRegistered, runRetainLlm } from "./retain-llm-port.ts";
import { collectRetainPassiveHits, type RetainTextItem } from "./retain-passive-recall.ts";
import type { MemoryProvenance } from "./types.ts";

const RETAIN_TOOL_NAMES = [
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_semantic_deprecate",
] as const;

function formatDialogueFromTexts(texts: string[]): string {
  const lines = texts.map((t, i) => `### turn ${i + 1}\n${t.trim()}`).filter((l) => l.length > 10);
  return lines.join("\n\n");
}

export type BuiltinRetainInput = {
  conversation_id: string;
  message_ids: string[];
  /** @deprecated 优先 text_items；无 role 时整段当 user 召回 */
  texts?: string[];
  /** 本回合 user/assistant 正文（含 role）；语义相关按条召回 */
  text_items?: RetainTextItem[];
  source: MemoryProvenance;
  /** @deprecated 忽略；retain 不再注入自我层 */
  selfContent?: string;
};

export type BuiltinRetainResult = {
  created: number[];
  updated: number[];
  skipped: boolean;
  summary?: string;
};

function resolveTextItems(input: BuiltinRetainInput): RetainTextItem[] {
  if (input.text_items && input.text_items.length > 0) {
    return input.text_items
      .map((i) => ({ role: i.role, content: i.content.trim() }))
      .filter((i) => i.content.length > 0);
  }
  return (input.texts ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .map((content) => ({ role: "user" as const, content }));
}

export async function runBuiltinRetain(input: BuiltinRetainInput): Promise<BuiltinRetainResult> {
  if (!isRetainLlmRegistered()) {
    logComponent("memory").debug("retain LLM not registered; skip extraction", {
      conversation_id: input.conversation_id,
    });
    return { created: [], updated: [], skipped: true, summary: "retain_llm_unregistered" };
  }

  const textItems = resolveTextItems(input);
  const texts = textItems.map((i) => i.content);
  if (texts.length === 0) {
    return { created: [], updated: [], skipped: true, summary: "no_texts" };
  }

  const related = await listSemanticMemoryBySourceSessions([input.conversation_id]);
  const relatedIds = new Set(related.map((r) => r.id));

  const dataParts: { tag?: string; body: string }[] = [];
  if (related.length > 0) {
    dataParts.push({
      tag: PROMPT_XML_TAGS.relatedMemories,
      body: formatExistingMemoriesMessage(related),
    });
  }

  try {
    const config = resolvePassiveRecallConfig(getActiveRuntimeConfig().data);
    const hits = await collectRetainPassiveHits(textItems, relatedIds, config);
    const block = formatPassiveMemoryBlock(hits, 6_000);
    if (block) {
      dataParts.push({ body: block, tag: "" });
    }
  } catch (e) {
    logComponent("memory").warn("retain passive-style recall failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  dataParts.push({
    tag: PROMPT_XML_TAGS.sourceData,
    body: formatDialogueFromTexts(texts),
  });

  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "memory-retain",
    taskSpec: RETAIN_TASK_SPEC,
    dataParts,
  });

  return withRetainProvenance(input.source, async () => {
    const llm = await runRetainLlm({
      systemPrompt,
      userMessages,
      toolNames: [...RETAIN_TOOL_NAMES],
    });

    for (const id of llm.semantic_memory_ids) {
      try {
        await updateSemanticMemory({
          id,
          source: input.source,
          source_conversations: [input.conversation_id],
        });
      } catch {
        /* ignore patch failures */
      }
    }

    logComponent("memory").info("builtin retain completed", {
      conversation_id: input.conversation_id,
      tool_calls: llm.tool_calls,
      semantic_ids: llm.semantic_memory_ids.length,
    });

    return {
      created: llm.semantic_memory_ids,
      updated: [],
      skipped: false,
      summary: llm.summary,
    };
  });
}
