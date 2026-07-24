import { aggregateUserActivityStats } from "@freeanima/host/core/db/pg/conversation";
import {
  currentUserActivityAsOfDay,
  loadUserActivityStatsCache,
  saveUserActivityStatsCache,
} from "./cache.ts";
import { formatUserActivityStatsPromptSection } from "./format.ts";
import { buildUserActivityWindows } from "./windows.ts";

export async function buildUserActivityStatsPromptSectionContent(
  nowMs: number = Date.now(),
): Promise<string> {
  const asOfDay = currentUserActivityAsOfDay(nowMs);
  const cached = await loadUserActivityStatsCache(asOfDay);
  if (cached) {
    return formatUserActivityStatsPromptSection(cached.as_of_day, cached.windows, cached.stats);
  }

  const { as_of_day, windows } = buildUserActivityWindows(nowMs);
  const stats = await aggregateUserActivityStats(
    windows.map((w) => ({ id: w.id, from_iso: w.from_iso, to_iso: w.to_iso })),
  );
  await saveUserActivityStatsCache({ as_of_day, windows, stats }, nowMs);
  return formatUserActivityStatsPromptSection(as_of_day, windows, stats);
}
