import * as engine from "@freeanima/orchestration-loop";
import { runWithToolContext } from "@freeanima/mechanism-tool";
import type { SessionMessage } from "@freeanima/storage-db/domain";
import { PROFILE_REFLECT } from "@freeanima/storage-provider-llm";
import { getProfileHopModel } from "@freeanima/storage-config";
import { applyDeepSleepToolResult } from "@freeanima/capabilities-memory";
import {
  registerDeepSleepEngine,
  type DeepSleepEngineInput,
  type DeepSleepEngineResult,
} from "@freeanima/capabilities-memory/deep-sleep-port";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
import {
  filterToolNamesByMask,
  resolveSleepMask,
  runtimeToolMaskFromResolved,
} from "./mask-wire.ts";

function buildMessages(input: DeepSleepEngineInput): SessionMessage[] {
  const now = new Date().toISOString();
  const msgs: SessionMessage[] = [{ role: "system", content: input.systemPrompt }];
  for (const content of input.userMessages) {
    msgs.push({ role: "user", content, timestamp: now });
  }
  return msgs;
}

async function runDeepSleepTurn(
  deps: FullRuntimeDeps,
  input: DeepSleepEngineInput,
): Promise<DeepSleepEngineResult> {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask(deps);
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(toolNames);
  const toolMask = runtimeToolMaskFromResolved(sleepMask);
  const messages = buildMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];

  await runWithToolContext(
    "deep-sleep",
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
            if (input.changeLog) {
              applyDeepSleepToolResult(input.changeLog, ev.data.name, ev.data.content);
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
  return { summary: summary.slice(0, 2000), tool_calls: toolCalls };
}

/** Register deep-sleep LLM engine */
export function registerDeepSleepWire(deps: FullRuntimeDeps): void {
  registerDeepSleepEngine((input) => runDeepSleepTurn(deps, input));
}
