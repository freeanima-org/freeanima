import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { buildDreamEngineInput } from "./build-messages.ts";
import { runDreamEngine } from "../dream-engine-port.ts";
import { cstDayRange } from "../light-sleep/build-messages.ts";
import {
  createDreamEntry,
  getDreamEntryByDay,
  resolveDreamWorldId,
} from "@freeanima/habitat/core/db/pg/dream";
import { gatherDreamInput, hasDreamFuel } from "./gather-input.ts";
import { recordDreamRun } from "./state.ts";

export type DreamResult = {
  ok: boolean;
  day: string;
  dream_id?: number;
  summary: string;
  skipped?: string;
};

export type RunDreamOpts = {
  day?: string;
  selfContent: string;
};

export async function runDream(opts: RunDreamOpts): Promise<DreamResult> {
  const day = cstDayRange(opts.day).day;
  const worldId = await resolveDreamWorldId();
  const ctx = { worldId };

  const existing = await getDreamEntryByDay(ctx, day);
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

  const input = await gatherDreamInput(omitUndefined({ day: opts.day }));

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

  const created = await createDreamEntry(ctx, {
    dream_day: input.day,
    content,
    source_limbic_ids: input.limbicMemories.map((r) => r.id),
    source_conversation_ids: input.conversationIds,
    episodic_snippets: input.episodicSnippets,
  });

  logComponent("memory").info("dream generation completed", {
    day: input.day,
    dream_id: created.id,
  });

  recordDreamRun({
    last_day: input.day,
    last_skipped: undefined,
    last_dream_id: created.id,
  });

  return {
    ok: true,
    day: input.day,
    dream_id: created.id,
    summary: `Dream created for ${input.day}`,
  };
}
