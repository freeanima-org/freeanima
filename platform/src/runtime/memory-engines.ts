import * as engine from "@freeanima/runtime/loop";
import { isTransientNetworkError } from "@freeanima/runtime/loop";
import { runWithToolContext } from "@freeanima/core/tool";
import type { SessionMessage } from "@freeanima/core/db/domain";
import { PROFILE_REFLECT } from "@freeanima/core/provider";
import { chat } from "@freeanima/core/llm";
import { DREAM_LLM_TEMPERATURE } from "@freeanima/capabilities-memory/dream/gather-input";
import { getProfileHopModel } from "@freeanima/core/config";
import { applyDeepSleepToolResult } from "@freeanima/capabilities-memory";
import {
  registerLightSleepEngine,
  type LightSleepEngineInput,
  type LightSleepEngineResult,
} from "@freeanima/capabilities-memory/light-sleep-port";
import {
  registerDeepSleepEngine,
  type DeepSleepEngineInput,
  type DeepSleepEngineResult,
} from "@freeanima/capabilities-memory/deep-sleep-port";
import {
  registerAutobiographyEngine,
  type AutobiographyEngineInput,
  type AutobiographyEngineResult,
} from "@freeanima/capabilities-memory/autobiography-port";
import {
  registerDreamEngine,
  type DreamEngineInput,
  type DreamEngineResult,
} from "@freeanima/capabilities-memory/dream-engine-port";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
import {
  filterToolNamesByMask,
  resolveSleepMask,
  runtimeToolMaskFromResolved,
} from "./mask-wire.ts";

const LIGHT_SLEEP_MAX_TURNS = 50;
const DEEP_SLEEP_MAX_TURNS = 100;
const SLEEP_LLM_MAX_ATTEMPTS = 3;
const SLEEP_LLM_RETRY_BASE_MS = 500;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSleepLlmRetryable(err: unknown): boolean {
  if (isTransientNetworkError(err)) return true;
  if (err instanceof Error) {
    return /LLM call failed/i.test(err.message) && isTransientNetworkError(err.cause ?? err);
  }
  return false;
}

const SEMANTIC_MEMORY_WRITE_TOOLS = new Set([
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_remember",
]);

type SleepStreamInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
};

type SleepStreamOptions = {
  toolContextId: string;
  maxTurns: number;
  onToolResult?: (name: string, content: string) => void;
};

function buildSleepMessages(input: SleepStreamInput): SessionMessage[] {
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

async function runSleepStream(
  deps: FullRuntimeDeps,
  input: SleepStreamInput,
  opts: SleepStreamOptions,
): Promise<{ summary: string; toolCalls: number }> {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask(deps);
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(toolNames);
  const toolMask = runtimeToolMaskFromResolved(sleepMask);
  const messages = buildSleepMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];

  let lastErr: unknown;
  for (let attempt = 0; attempt < SLEEP_LLM_MAX_ATTEMPTS; attempt++) {
    toolCalls = 0;
    parts.length = 0;
    try {
      await runWithToolContext(
        opts.toolContextId,
        async () => {
          for await (const ev of engine.runStream(messages, {
            model,
            tools,
            config: deps.engine.config.data,
            logger: deps.engine.logger,
            llm: deps.engine.llm,
            toolMask,
            max_turns: opts.maxTurns,
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
              case "tool_result":
                opts.onToolResult?.(ev.data.name, ev.data.content);
                break;
              case "error":
                throw new Error(ev.data.error);
              default:
                break;
            }
          }
        },
        { repos: deps.conversation.repos, tools: deps.engine.catalog.toolSets },
      );
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (!isSleepLlmRetryable(err) || attempt >= SLEEP_LLM_MAX_ATTEMPTS - 1) {
        throw err;
      }
      await sleepMs(SLEEP_LLM_RETRY_BASE_MS * (attempt + 1));
    }
  }
  if (lastErr) throw lastErr;

  const summary = parts.join("").trim() || `Completed ${toolCalls} tool call(s)`;
  return { summary: summary.slice(0, 2000), toolCalls };
}

async function runLightSleepTurn(
  deps: FullRuntimeDeps,
  input: LightSleepEngineInput,
): Promise<LightSleepEngineResult> {
  const semanticMemoryIds: string[] = [];
  const limbicMemoryIds: string[] = [];
  const { summary, toolCalls } = await runSleepStream(deps, input, {
    toolContextId: "light-sleep",
    maxTurns: LIGHT_SLEEP_MAX_TURNS,
    onToolResult: (name, content) => {
      const semanticId = extractSemanticMemoryId(name, content);
      if (semanticId && !semanticMemoryIds.includes(semanticId)) {
        semanticMemoryIds.push(semanticId);
      }
      const limbicId = extractLimbicMemoryId(name, content);
      if (limbicId && !limbicMemoryIds.includes(limbicId)) {
        limbicMemoryIds.push(limbicId);
      }
    },
  });
  return {
    summary,
    tool_calls: toolCalls,
    semantic_memory_ids: semanticMemoryIds,
    limbic_memory_ids: limbicMemoryIds,
  };
}

async function runDeepSleepTurn(
  deps: FullRuntimeDeps,
  input: DeepSleepEngineInput,
): Promise<DeepSleepEngineResult> {
  const { summary, toolCalls } = await runSleepStream(deps, input, {
    toolContextId: "deep-sleep",
    maxTurns: DEEP_SLEEP_MAX_TURNS,
    onToolResult: (name, content) => {
      if (input.changeLog) {
        applyDeepSleepToolResult(input.changeLog, name, content);
      }
    },
  });
  return { summary, tool_calls: toolCalls };
}

async function runAutobiographyTurn(
  deps: FullRuntimeDeps,
  input: AutobiographyEngineInput,
): Promise<AutobiographyEngineResult> {
  const { summary, toolCalls } = await runSleepStream(deps, input, {
    toolContextId: "self-autobiography",
    maxTurns: 20,
  });
  return { summary, tool_calls: toolCalls };
}

async function runDreamTurn(
  deps: FullRuntimeDeps,
  input: DreamEngineInput,
): Promise<DreamEngineResult> {
  const response = await chat(
    [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userMessage },
    ],
    {
      profileId: PROFILE_REFLECT,
      runtime: deps.engine.llm,
      requestParams: { temperature: DREAM_LLM_TEMPERATURE },
    },
  );
  return { content: String(response.content ?? "").trim() };
}

/** Register light/deep/autobiography/dream LLM engines (shared runStream template) */
export function registerMemoryEngineWires(deps: FullRuntimeDeps): void {
  registerLightSleepEngine((input) => runLightSleepTurn(deps, input));
  registerDeepSleepEngine((input) => runDeepSleepTurn(deps, input));
  registerAutobiographyEngine((input) => runAutobiographyTurn(deps, input));
  registerDreamEngine((input) => runDreamTurn(deps, input));
}
