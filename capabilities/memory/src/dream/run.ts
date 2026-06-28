import { logCapability as logComponent } from "@freeanima/core/config";
import { createDreamMemory, getDreamMemoryByDay } from "@freeanima/core/db/pg/dream-memory";

import { buildDreamEngineInput } from "./build-messages.ts";
import { runDreamEngine } from "../dream-engine-port.ts";
import { cstDayRange } from "../light-sleep/build-messages.ts";
import { gatherDreamInput, hasDreamFuel } from "./gather-input.ts";
import { recordDreamRun } from "./state.ts";

export type DreamFridgePort = {
  setReminder(day: string, teaser: string): Promise<void>;
  dismissReminder(day: string): Promise<void>;
};

export type DreamResult = {
  ok: boolean;
  day: string;
  dream_id?: string;
  summary: string;
  skipped?: string;
};

export type RunDreamOpts = {
  day?: string;
  selfContent: string;
  fridge?: DreamFridgePort;
};

const DREAM_REMINDER_TEASER = "我昨晚做了一个梦，想聊聊吗？";

export async function runDream(opts: RunDreamOpts): Promise<DreamResult> {
  const day = cstDayRange(opts.day).day;

  const existing = await getDreamMemoryByDay(day);
  if (existing) {
    const result: DreamResult = {
      ok: true,
      day,
      dream_id: existing.id,
      summary: `Dream already exists for ${day}`,
      skipped: "already_dreamed",
    };
    recordDreamRun({
      last_day: day,
      last_skipped: result.skipped,
      last_dream_id: existing.id,
    });
    return result;
  }

  const input = await gatherDreamInput({ day: opts.day });

  if (!hasDreamFuel(input)) {
    const result: DreamResult = {
      ok: true,
      day: input.day,
      summary: "No strong emotional memories (intensity > 0.5); skipping dream",
      skipped: "no_strong_emotion",
    };
    recordDreamRun({ last_day: input.day, last_skipped: result.skipped });
    return result;
  }

  logComponent("memory").info("dream generation started", {
    day: input.day,
    limbic_count: input.limbicMemories.length,
    episodic_count: input.episodicSnippets.length,
  });

  const engineInput = buildDreamEngineInput(opts.selfContent, input);
  const generated = await runDreamEngine(engineInput);
  const content = generated.content.trim();
  if (!content) {
    const result: DreamResult = {
      ok: false,
      day: input.day,
      summary: "Dream generation returned empty content",
    };
    recordDreamRun({ last_day: input.day, last_skipped: "empty_content" });
    return result;
  }

  const dreamId = await createDreamMemory({
    dream_day: input.day,
    content,
    source_limbic_ids: input.limbicMemories.map((r) => r.id),
    source_conversation_ids: input.conversationIds,
    episodic_snippets: input.episodicSnippets,
  });

  if (opts.fridge) {
    await opts.fridge.setReminder(input.day, DREAM_REMINDER_TEASER);
  }

  logComponent("memory").info("dream generation completed", {
    day: input.day,
    dream_id: dreamId,
  });

  recordDreamRun({
    last_day: input.day,
    last_skipped: undefined,
    last_dream_id: dreamId,
  });

  return {
    ok: true,
    day: input.day,
    dream_id: dreamId,
    summary: `Dream created for ${input.day}`,
  };
}

export async function dismissDreamReminder(
  fridge: DreamFridgePort | undefined,
  day: string,
): Promise<void> {
  if (!fridge) return;
  await fridge.dismissReminder(day);
}
