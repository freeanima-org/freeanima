import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-loop";
import { openaiSchemasFromNames } from "@freeanima/engine-tool";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import { PROFILE_REFLECT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
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
  "create_semantic_memory",
  "update_semantic_memory",
  "remember",
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

async function runLightSleepTurn(input: LightSleepEngineInput): Promise<LightSleepEngineResult> {
  const { conversation } = getServiceContext();
  const cfg = loadConfig();
  const model = getProfileHopModel(cfg, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask();
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = openaiSchemasFromNames(toolNames);
  const toolMask = runtimeToolMaskFromResolved(sleepMask);
  const messages = buildMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];
  const semanticMemoryIds: string[] = [];

  await runWithToolContext(
    "light-sleep",
    async () => {
      for await (const ev of engine.runStream(messages, {
        model,
        tools,
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
            const id = extractSemanticMemoryId(ev.data.name, ev.data.content);
            if (id && !semanticMemoryIds.includes(id)) semanticMemoryIds.push(id);
            break;
          }
          case "error":
            throw new Error(ev.data.error);
          default:
            break;
        }
      }
    },
    { repos: conversation.repos },
  );

  const summary = parts.join("").trim() || `完成 ${toolCalls} 次工具调用`;
  return {
    summary: summary.slice(0, 2000),
    tool_calls: toolCalls,
    semantic_memory_ids: semanticMemoryIds,
  };
}

/** 注册浅睡 LLM 引擎（engine.run + 工具白名单） */
export function registerLightSleepWire(): void {
  registerLightSleepEngine(runLightSleepTurn);
}
