import * as engine from "@freeanima/orchestration-loop";
import { runWithToolContext } from "@freeanima/mechanism-tool";
import type { SessionMessage } from "@freeanima/storage-db/domain";
import { PROFILE_REFLECT } from "@freeanima/storage-provider-llm";
import { getProfileHopModel } from "@freeanima/storage-config";
import {
  registerLightSleepEngine,
  type LightSleepEngineInput,
  type LightSleepEngineResult,
} from "@freeanima/capabilities-memory/light-sleep-port";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
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

async function runLightSleepTurn(
  deps: FullRuntimeDeps,
  input: LightSleepEngineInput,
): Promise<LightSleepEngineResult> {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask(deps);
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(toolNames);
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
        config: deps.engine.config.data,
        logger: deps.engine.logger,
        llm: deps.engine.llm,
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
    { repos: deps.conversation.repos, tools: deps.engine.catalog.toolSets },
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
export function registerLightSleepWire(deps: FullRuntimeDeps): void {
  registerLightSleepEngine((input) => runLightSleepTurn(deps, input));
}
