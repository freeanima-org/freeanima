import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-tool";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import { PROFILE_REFLECT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel } from "@freeanima/engine-config";
import {
  registerLightSleepEngine,
  type LightSleepEngineInput,
  type LightSleepEngineResult,
} from "@freeanima/life-memory/light-sleep-port";

import { getServiceContext } from "../context.ts";
import {
  filterToolNamesByMask,
  resolveSleepMask,
  runtimeToolMaskFromResolved,
} from "./mask-wire.ts";

const SEMANTIC_MEMORY_WRITE_TOOLS = new Set([
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_remember",
]);

function buildMessages(input: LightSleepEngineInput): SessionMessage[] {
  const now = new Date().toISOString();
  const messages: SessionMessage[] = [{ role: "system", content: input.systemPrompt }];
  for (const content of input.userMessages) {
    messages.push({ role: "user", content, timestamp: now });
  }
  return messages;
}

function extractSemanticMemoryId(toolName: string, content: string): string | null {
  if (!SEMANTIC_MEMORY_WRITE_TOOLS.has(toolName)) return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.error) return null;
    const id = String(parsed.semantic_memory_id ?? parsed.id ?? parsed.fact_id ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}

function extractLimbicMemoryId(toolName: string, content: string): string | null {
  if (toolName !== "memory_limbic_create") return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.error) return null;
    const id = String(parsed.id ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}

async function runLightSleepTurn(input: LightSleepEngineInput): Promise<LightSleepEngineResult> {
  const { conversation, engine: eng } = getServiceContext();
  const model = getProfileHopModel(eng.config.data, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask();
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = eng.catalog.toolSets.openaiSchemasFromNames(toolNames);
  const toolMask = runtimeToolMaskFromResolved(sleepMask);
  const messages = buildMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];
  const semanticMemoryIds: string[] = [];
  const limbicMemoryIds: string[] = [];

  await runWithToolContext(
    "light-sleep",
    async () => {
      for await (const ev of engine.runStream(messages, {
        model,
        tools,
        config: eng.config.data,
        logger: eng.logger,
        llm: eng.llm,
        toolMask,
        max_turns: 50,
      })) {
        switch (ev.event) {
          case "token":
            parts.push(ev.data.content);
            break;
          case "content_replace":
            parts.length = 0;
            parts.push(ev.data.content);
            break;
          case "tool_begin":
            toolCalls += 1;
            break;
          case "tool_result": {
            const semanticId = extractSemanticMemoryId(ev.data.name, ev.data.content);
            if (semanticId && !semanticMemoryIds.includes(semanticId)) {
              semanticMemoryIds.push(semanticId);
            }
            const limbicId = extractLimbicMemoryId(ev.data.name, ev.data.content);
            if (limbicId && !limbicMemoryIds.includes(limbicId)) {
              limbicMemoryIds.push(limbicId);
            }
            break;
          }
          case "error":
            throw new Error(ev.data.error);
          default:
            break;
        }
      }
    },
    { repos: conversation.repos, tools: eng.catalog.toolSets },
  );

  const summary = parts.join("").trim() || `Completed ${toolCalls} tool call(s)`;
  return {
    summary: summary.slice(0, 2000),
    tool_calls: toolCalls,
    semantic_memory_ids: semanticMemoryIds,
    limbic_memory_ids: limbicMemoryIds,
  };
}

/** Register light-sleep LLM engine (engine.run + tool whitelist) */
export function registerLightSleepWire(): void {
  registerLightSleepEngine(runLightSleepTurn);
}
