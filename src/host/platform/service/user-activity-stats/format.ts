import type { UserActivityStats } from "@freeanima/host/core/db/pg/conversation";
import type { ActivityWindowDef } from "./windows.ts";

const PROMPT_FRAME =
  "Below is a user-activity panel (static session snapshot, CST calendar days). " +
  "It counts user-side dialogue density (new/updated conversations and user messages); " +
  "it refreshes when the system prompt is rebuilt (daily boundary), not as live counters.";

export function formatUserActivityStatsPromptSection(
  asOfDay: string,
  windows: ActivityWindowDef[],
  stats: UserActivityStats,
): string {
  const lines = windows.map((w) => {
    const c = stats[w.id];
    return `${w.label}：新开 ${c.created} / 更新 ${c.updated} / 消息 ${c.user_messages}`;
  });
  return `${PROMPT_FRAME}\n\n## 用户活跃统计（截至 ${asOfDay}）\n\`\`\`md\n${lines.join("\n")}\n\`\`\``;
}
