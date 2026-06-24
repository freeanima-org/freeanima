import { randomInt } from "node:crypto";

import type { DreamEpisodicSnippet } from "@freeanima/core/db/schema";
import type { LimbicMemoryRow, SessionStorePort } from "@freeanima/core/repos";
import { CST_OFFSET_MS } from "@freeanima/core/util";

import { filterRecallableMessages } from "../message-filter.ts";
import { getLimbicMemoryStore } from "../limbic-port.ts";
import { getMemorySessionStore } from "../session-port.ts";
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
  sessionIds: string[];
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

function sampleEpisodicSnippets(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<DreamEpisodicSnippet[]> {
  return sampleEpisodicSnippetsAsync(sessionStore, sessionIds);
}

async function sampleEpisodicSnippetsAsync(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<DreamEpisodicSnippet[]> {
  const pool: DreamEpisodicSnippet[] = [];
  for (const sessionId of sessionIds) {
    const messages = filterRecallableMessages(await sessionStore.listMessages(sessionId));
    for (const msg of messages) {
      pool.push({
        session_id: sessionId,
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
    const list = bySession.get(item.session_id) ?? [];
    list.push(item);
    bySession.set(item.session_id, list);
  }

  const sessionKeys = [...bySession.keys()];
  shuffleInPlace(sessionKeys);

  const picked: DreamEpisodicSnippet[] = [];
  let totalChars = 0;
  let round = 0;

  while (picked.length < DREAM_EPISODIC_TARGET && round < sessionKeys.length * 4) {
    const sessionId = sessionKeys[round % sessionKeys.length];
    if (!sessionId) break;
    const list = bySession.get(sessionId) ?? [];
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
  sessionStore?: SessionStorePort;
};

/** Collect dream inputs for a CST calendar day (after light sleep limbic writes). */
export async function gatherDreamInput(opts?: GatherDreamInputOpts): Promise<DreamGatherInput> {
  const sessionStore = opts?.sessionStore ?? getMemorySessionStore();
  const range = cstDayRange(opts?.day);
  const limbicRange = limbicCreatedRange(range);
  const sessionIds = await sessionStore.listSessionIdsUpdatedBetween(range.fromIso, range.toIso);
  const limbicMemories = await getLimbicMemoryStore().listByCreatedBetween(
    limbicRange.fromIso,
    limbicRange.toIso,
    {
      minIntensity: DREAM_MIN_INTENSITY,
      limit: DREAM_LIMBIC_LIMIT,
      orderBy: "intensity_desc",
    },
  );
  const episodicSnippets = sessionIds.length
    ? await sampleEpisodicSnippets(sessionStore, sessionIds)
    : [];

  return {
    day: range.day,
    fromIso: range.fromIso,
    toIso: range.toIso,
    sessionIds,
    limbicMemories,
    episodicSnippets,
  };
}

export function hasDreamFuel(input: DreamGatherInput): boolean {
  return input.limbicMemories.length > 0;
}
