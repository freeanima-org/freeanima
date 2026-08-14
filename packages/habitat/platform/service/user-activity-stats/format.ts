import type { UserActivityStats } from "@freeanima/habitat/core/db/pg/conversation";
import { PROMPT_XML_TAGS, wrapPromptXmlSection } from "@freeanima/habitat/core/hooks/prompt";
import type { ActivityWindowDef } from "./windows.ts";

export const USER_ACTIVITY_PROMPT_FRAME =
  "Below is a user-activity panel (static session snapshot, CST calendar days). " +
  "It counts user-side dialogue density (new/updated conversations and user messages); " +
  "it refreshes when the system prompt is rebuilt (daily boundary), not as live counters.";

export function formatUserActivityStatsBody(
  asOfDay: string,
  windows: ActivityWindowDef[],
  stats: UserActivityStats,
): string {
  const lines = windows.map((w) => {
    const c = stats[w.id];
    return `${w.label}：新开 ${c.created} / 更新 ${c.updated} / 消息 ${c.user_messages}`;
  });
  return `截至 ${asOfDay}。\n${lines.join("\n")}`;
}

export function formatUserActivityStatsPromptSection(
  asOfDay: string,
  windows: ActivityWindowDef[],
  stats: UserActivityStats,
): string {
  return wrapPromptXmlSection(
    PROMPT_XML_TAGS.userActivity,
    formatUserActivityStatsBody(asOfDay, windows, stats),
    { frame: USER_ACTIVITY_PROMPT_FRAME },
  );
}
