import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-loop";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import { PROFILE_REFLECT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import {
  registerAutobiographyEngine,
  type AutobiographyEngineInput,
  type AutobiographyEngineResult,
} from "@freeanima/life-memory/autobiography-port";

import { getServiceContext } from "../context.ts";
import {
  filterToolNamesByMask,
  resolveSleepMask,
  runtimeToolMaskFromResolved,
} from "./mask-wire.ts";

function buildMessages(input: AutobiographyEngineInput): SessionMessage[] {
  const now = new Date().toISOString();
  const msgs: SessionMessage[] = [{ role: "system", content: input.systemPrompt }];
  for (const content of input.userMessages) {
    msgs.push({ role: "user", content, timestamp: now });
  }
  return msgs;
}

async function runAutobiographyTurn(
  input: AutobiographyEngineInput,
): Promise<AutobiographyEngineResult> {
  const { conversation, engine: eng } = getServiceContext();
  const cfg = loadConfig();
  const model = getProfileHopModel(cfg, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask();
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = eng.catalog.toolSets.openaiSchemasFromNames(toolNames);
  const toolMask = runtimeToolMaskFromResolved(sleepMask);
  const messages = buildMessages(input);

  let toolCalls = 0;
  const parts: string[] = [];

  await runWithToolContext(
    "self-autobiography",
    async () => {
      for await (const ev of engine.runStream(messages, {
        model,
        tools,
        toolMask,
        max_turns: 20,
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
          case "error":
            throw new Error(ev.data.error);
          default:
            break;
        }
      }
    },
    { repos: conversation.repos, tools: eng.catalog.toolSets },
  );

  const summary = parts.join("").trim() || `完成 ${toolCalls} 次工具调用`;
  return { summary: summary.slice(0, 2000), tool_calls: toolCalls };
}

/** 注册自传 cron LLM 引擎 */
export function registerAutobiographyWire(): void {
  registerAutobiographyEngine(runAutobiographyTurn);
}
