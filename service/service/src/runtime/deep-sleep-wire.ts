import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-tool";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import { PROFILE_REFLECT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel } from "@freeanima/engine-config";
import { applyDeepSleepToolResult } from "@freeanima/life-memory";
import {
  registerDeepSleepEngine,
  type DeepSleepEngineInput,
  type DeepSleepEngineResult,
} from "@freeanima/life-memory/deep-sleep-port";

import { getServiceContext } from "../context.ts";
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

async function runDeepSleepTurn(input: DeepSleepEngineInput): Promise<DeepSleepEngineResult> {
  const { conversation, engine: eng } = getServiceContext();
  const model = getProfileHopModel(eng.config.data, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask();
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = eng.catalog.toolSets.openaiSchemasFromNames(toolNames);
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
    { repos: conversation.repos, tools: eng.catalog.toolSets },
  );

  const summary = parts.join("").trim() || `Completed ${toolCalls} tool call(s)`;
  return { summary: summary.slice(0, 2000), tool_calls: toolCalls };
}

/** Register deep-sleep LLM engine */
export function registerDeepSleepWire(): void {
  registerDeepSleepEngine(runDeepSleepTurn);
}
