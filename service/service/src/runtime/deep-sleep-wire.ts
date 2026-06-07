import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-loop";
import { openaiSchemasFromNames } from "@freeanima/engine-tool";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import { PROFILE_REFLECT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import {
  registerDeepSleepEngine,
  type DeepSleepEngineInput,
  type DeepSleepEngineResult,
} from "@freeanima/life-memory/deep-sleep-port";

import { getServiceContext } from "../context.ts";

function buildMessages(input: DeepSleepEngineInput): SessionMessage[] {
  const now = new Date().toISOString();
  const msgs: SessionMessage[] = [{ role: "system", content: input.systemPrompt }];
  for (const content of input.userMessages) {
    msgs.push({ role: "user", content, timestamp: now });
  }
  return msgs;
}

async function runDeepSleepTurn(input: DeepSleepEngineInput): Promise<DeepSleepEngineResult> {
  const { conversation } = getServiceContext();
  const cfg = loadConfig();
  const model = getProfileHopModel(cfg, PROFILE_REFLECT);
  const tools = openaiSchemasFromNames(input.toolNames);
  const messages = buildMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];

  await runWithToolContext(
    "deep-sleep",
    async () => {
      for await (const ev of engine.runStream(messages, { model, tools, max_turns: 50 })) {
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
  return { summary: summary.slice(0, 2000), tool_calls: toolCalls };
}

/** 注册深睡 LLM 引擎 */
export function registerDeepSleepWire(): void {
  registerDeepSleepEngine(runDeepSleepTurn);
}
