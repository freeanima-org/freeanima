import type { EnvHealthMarkers } from "./types.ts";
import type { EnvHealthDiff } from "./diff.ts";

const PROMPT_FRAME =
  "Below is your environment and health baseline (static session snapshot). " +
  "It reflects the last quiet observation at prompt build time; live changes arrive as system notifications.";

const LABEL: Record<keyof EnvHealthMarkers, string> = {
  hostname: "Hostname",
  os: "OS",
  timezone: "Timezone",
  hub_version: "Habitat version",
  boot_started_at: "Boot started at",
  postgres: "PostgreSQL",
  redis: "Redis",
  rss_band: "RSS band",
  mcp_connected: "MCP connected",
  mcp_servers: "MCP servers",
  acp_connected: "ACP connected",
  acp_agents: "ACP agents",
  disk_free_band: "Disk free (FREEANIMA_HOME)",
};

export function formatMarkersBlock(markers: EnvHealthMarkers): string {
  const keys = Object.keys(LABEL) as (keyof EnvHealthMarkers)[];
  return keys.map((k) => `- ${LABEL[k]}: ${String(markers[k])}`).join("\n");
}

/** System prompt section body */
export function formatEnvHealthPromptSection(markers: EnvHealthMarkers): string {
  const body = formatMarkersBlock(markers);
  return `${PROMPT_FRAME}\n\n## Environment + health baseline\n\`\`\`md\n${body}\n\`\`\``;
}

export function formatChangeNotificationTitle(changedKeys: (keyof EnvHealthMarkers)[]): string {
  const n = changedKeys.length;
  if (n === 1) {
    const key = changedKeys[0];
    const label = key != null ? (LABEL[key] ?? key) : "unknown";
    return `环境/健康变更：${label}`;
  }
  return `环境/健康变更（${n} 项）`;
}

export function formatChangeNotificationBody(
  current: EnvHealthMarkers,
  baseline: EnvHealthMarkers,
  diff: EnvHealthDiff,
): string {
  const lines = diff.changedKeys.map((k) => {
    const label = LABEL[k] ?? k;
    return `- ${label}: ${String(baseline[k])} → ${String(current[k])}`;
  });
  return ["检测到环境或健康标记相对基线发生变化：", "", ...lines].join("\n");
}
