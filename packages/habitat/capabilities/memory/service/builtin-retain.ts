/**
 * 内建 retain：浅睡语义抽取迁入 MemoryService（#16102）。
 * LLM 仅经 retain-llm-port；未注册 LLM 时跳过抽取（仍由调用方推进 watermark）。
 */

import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { listSemanticMemoryBySourceSessions } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { updateSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import {
  LIGHT_SLEEP_INSTRUCTION_MESSAGE,
  formatExistingMemoriesMessage,
} from "../light-sleep/build-messages.ts";
import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";

import { withRetainProvenance } from "./retain-context.ts";
import { isRetainLlmRegistered, runRetainLlm } from "./retain-llm-port.ts";
import type { MemoryProvenance } from "./types.ts";

const RETAIN_TOOL_NAMES = [
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_semantic_deprecate",
] as const;

function formatDialogueFromTexts(texts: string[]): string {
  const lines = texts.map((t, i) => `### turn ${i + 1}\n${t.trim()}`).filter((l) => l.length > 10);
  return `# Dialogue to extract from\n\n${lines.join("\n\n")}`;
}

export type BuiltinRetainInput = {
  conversation_id: string;
  message_ids: string[];
  texts: string[];
  source: MemoryProvenance;
  selfContent?: string;
};

export type BuiltinRetainResult = {
  created: number[];
  updated: number[];
  skipped: boolean;
  summary?: string;
};

export async function runBuiltinRetain(input: BuiltinRetainInput): Promise<BuiltinRetainResult> {
  if (!isRetainLlmRegistered()) {
    logComponent("memory").debug("retain LLM not registered; skip extraction", {
      conversation_id: input.conversation_id,
    });
    return { created: [], updated: [], skipped: true, summary: "retain_llm_unregistered" };
  }

  const texts = input.texts.map((t) => t.trim()).filter(Boolean);
  if (texts.length === 0) {
    return { created: [], updated: [], skipped: true, summary: "no_texts" };
  }

  const selfContent = input.selfContent ?? (await loadSelfLayerPrompt());
  const parts = await decomposeSystemPromptParts(selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);

  const related = await listSemanticMemoryBySourceSessions([input.conversation_id]);
  const userMessages = [
    formatDialogueFromTexts(texts),
    formatExistingMemoriesMessage(related),
    LIGHT_SLEEP_INSTRUCTION_MESSAGE,
  ];

  return withRetainProvenance(input.source, async () => {
    const llm = await runRetainLlm({
      systemPrompt,
      userMessages,
      toolNames: [...RETAIN_TOOL_NAMES],
    });

    // 工具可能未带 source；补写 provenance
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
