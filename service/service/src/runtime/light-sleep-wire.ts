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

function buildMessages(input: LightSleepEngineInput): SessionMessage[] {
  const now = new Date().toISOString();
  return [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userMessages[0], timestamp: now },
    { role: "user", content: input.userMessages[1], timestamp: now },
    { role: "user", content: input.userMessages[2], timestamp: now },
  ];
}

async function runLightSleepTurn(input: LightSleepEngineInput): Promise<LightSleepEngineResult> {
  const { conversation } = getServiceContext();
  const cfg = loadConfig();
  const model = getProfileHopModel(cfg, PROFILE_REFLECT);
  const tools = openaiSchemasFromNames(input.toolNames);
  const messages = buildMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];

  await runWithToolContext(
    "light-sleep",
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

/** 注册浅睡 LLM 引擎（engine.run + 工具白名单） */
export function registerLightSleepWire(): void {
  registerLightSleepEngine(runLightSleepTurn);
}
