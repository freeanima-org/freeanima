import * as engine from "@freeanima/orchestration-loop";
import { runWithToolContext } from "@freeanima/mechanism-tool";
import type { SessionMessage } from "@freeanima/storage-db/domain";
import { PROFILE_REFLECT } from "@freeanima/storage-provider-llm";
import { getProfileHopModel } from "@freeanima/storage-config";
import {
  registerAutobiographyEngine,
  type AutobiographyEngineInput,
  type AutobiographyEngineResult,
} from "@freeanima/capabilities-memory/autobiography-port";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
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
  deps: FullRuntimeDeps,
  input: AutobiographyEngineInput,
): Promise<AutobiographyEngineResult> {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT);
  const sleepMask = resolveSleepMask(deps);
  const toolNames = filterToolNamesByMask(input.toolNames, sleepMask);
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(toolNames);
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
        config: deps.engine.config.data,
        logger: deps.engine.logger,
        llm: deps.engine.llm,
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
    { repos: deps.conversation.repos, tools: deps.engine.catalog.toolSets },
  );

  const summary = parts.join("").trim() || `Completed ${toolCalls} tool call(s)`;
  return { summary: summary.slice(0, 2000), tool_calls: toolCalls };
}

/** Register autobiography cron LLM engine */
export function registerAutobiographyWire(deps: FullRuntimeDeps): void {
  registerAutobiographyEngine((input) => runAutobiographyTurn(deps, input));
}
