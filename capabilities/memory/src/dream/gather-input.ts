import { randomInt } from "node:crypto";

import type { DreamEpisodicSnippet } from "@freeanima/core/db/schema";
import type { LimbicMemoryRow } from "@freeanima/core/repos";
import { CST_OFFSET_MS } from "@freeanima/core/util";
import {
  listConversationIdsUpdatedBetween,
  listMessages,
} from "@freeanima/core/db/pg/conversation";
import { listLimbicMemoryByCreatedBetween } from "@freeanima/core/db/pg/limbic-memory";

import { filterRecallableMessages } from "../message-filter.ts";
import { cstDayRange, type LightSleepDayRange } from "../light-sleep/build-messages.ts";

export const DREAM_MIN_INTENSITY = 0.5;
export const DREAM_LIMBIC_LIMIT = 3;
export const DREAM_LIMBIC_CREATED_GRACE_HOURS = 6;
export const DREAM_EPISODIC_TARGET = 5;
export const DREAM_EPISODIC_MAX_CHARS = 4000;
export const DREAM_LLM_TEMPERATURE = 1.1;

export type DreamGatherInput = {
  day: string;
  fromIso: string;
  toIso: string;
  conversationIds: string[];
  limbicMemories: LimbicMemoryRow[];
  episodicSnippets: DreamEpisodicSnippet[];
};

function addHoursToCstIso(iso: string, hours: number): string {
  const ms = new Date(iso).getTime() + hours * 60 * 60 * 1000;
  const cst = new Date(ms + CST_OFFSET_MS);
  const y = cst.getUTCFullYear();
  const mo = String(cst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(cst.getUTCDate()).padStart(2, "0");
  const h = String(cst.getUTCHours()).padStart(2, "0");
  const mi = String(cst.getUTCMinutes()).padStart(2, "0");
  const s = String(cst.getUTCSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`;
}

/** Limbic created_at window: conversation day start through next-morning grace (covers light sleep). */
export function limbicCreatedRange(range: LightSleepDayRange): { fromIso: string; toIso: string } {
  return {
    fromIso: range.fromIso,
    toIso: addHoursToCstIso(range.toIso, DREAM_LIMBIC_CREATED_GRACE_HOURS),
  };
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

async function sampleEpisodicSnippets(conversationIds: string[]): Promise<DreamEpisodicSnippet[]> {
  const pool: DreamEpisodicSnippet[] = [];
  for (const conversationId of conversationIds) {
    const messages = filterRecallableMessages(await listMessages(conversationId));
    for (const msg of messages) {
      pool.push({
        conversation_id: conversationId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.t || undefined,
      });
    }
  }
  if (!pool.length) return [];

  shuffleInPlace(pool);

  const bySession = new Map<string, DreamEpisodicSnippet[]>();
  for (const item of pool) {
    const list = bySession.get(item.conversation_id) ?? [];
    list.push(item);
    bySession.set(item.conversation_id, list);
  }

  const sessionKeys = [...bySession.keys()];
  shuffleInPlace(sessionKeys);

  const picked: DreamEpisodicSnippet[] = [];
  let totalChars = 0;
  let round = 0;

  while (picked.length < DREAM_EPISODIC_TARGET && round < sessionKeys.length * 4) {
    const conversationId = sessionKeys[round % sessionKeys.length];
    if (!conversationId) break;
    const list = bySession.get(conversationId) ?? [];
    if (!list.length) {
      round += 1;
      continue;
    }
    const idx = randomInt(list.length);
    const item = list.splice(idx, 1)[0];
    if (!item) {
      round += 1;
      continue;
    }
    const nextLen = totalChars + item.content.length;
    if (picked.length > 0 && nextLen > DREAM_EPISODIC_MAX_CHARS) break;
    picked.push(item);
    totalChars = nextLen;
    round += 1;
  }

  return picked;
}

export type GatherDreamInputOpts = {
  day?: string;
};

/** Collect dream inputs for a CST calendar day (after light sleep limbic writes). */
export async function gatherDreamInput(opts?: GatherDreamInputOpts): Promise<DreamGatherInput> {
  const range = cstDayRange(opts?.day);
  const limbicRange = limbicCreatedRange(range);
  const conversationIds = await listConversationIdsUpdatedBetween(range.fromIso, range.toIso);
  const limbicMemories = await listLimbicMemoryByCreatedBetween(
    limbicRange.fromIso,
    limbicRange.toIso,
    {
      minIntensity: DREAM_MIN_INTENSITY,
      limit: DREAM_LIMBIC_LIMIT,
      orderBy: "intensity_desc",
    },
  );
  const episodicSnippets = conversationIds.length
    ? await sampleEpisodicSnippets(conversationIds)
    : [];

  return {
    day: range.day,
    fromIso: range.fromIso,
    toIso: range.toIso,
    conversationIds,
    limbicMemories,
    episodicSnippets,
  };
}

export function hasDreamFuel(input: DreamGatherInput): boolean {
  return input.limbicMemories.length > 0;
}
