import { aggregateUserActivityStats } from "@freeanima/host/core/db/pg/conversation";
import {
  currentUserActivityAsOfDay,
  loadUserActivityStatsCache,
  saveUserActivityStatsCache,
} from "./cache.ts";
import { formatUserActivityStatsBody, formatUserActivityStatsPromptSection } from "./format.ts";
import { buildUserActivityWindows } from "./windows.ts";

async function loadStats(nowMs: number) {
  const asOfDay = currentUserActivityAsOfDay(nowMs);
  const cached = await loadUserActivityStatsCache(asOfDay);
  if (cached) return cached;

  const { as_of_day, windows } = buildUserActivityWindows(nowMs);
  const stats = await aggregateUserActivityStats(
    windows.map((w) => ({ id: w.id, from_iso: w.from_iso, to_iso: w.to_iso })),
  );
  await saveUserActivityStatsCache({ as_of_day, windows, stats }, nowMs);
  return { as_of_day, windows, stats };
}

/** Inner body for systemPromptBuild fold. */
export async function buildUserActivityStatsPromptBody(
  nowMs: number = Date.now(),
): Promise<string> {
  const { as_of_day, windows, stats } = await loadStats(nowMs);
  return formatUserActivityStatsBody(as_of_day, windows, stats);
}

export async function buildUserActivityStatsPromptSectionContent(
  nowMs: number = Date.now(),
): Promise<string> {
  const { as_of_day, windows, stats } = await loadStats(nowMs);
  return formatUserActivityStatsPromptSection(as_of_day, windows, stats);
}
