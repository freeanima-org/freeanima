import type { ConversationMetaLoadResult } from "@freeanima/habitat/core/db/domain";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import { asRecord } from "@freeanima/shared/util";

export const TOOL_DISPLAY_MODES = [
  "hidden",
  "count",
  "name",
  "name_args_truncated",
  "name_args_full",
  "name_args_result_full",
] as const;

export type ToolDisplayMode = (typeof TOOL_DISPLAY_MODES)[number];

export const DEFAULT_TOOL_DISPLAY_MODE: ToolDisplayMode = "name";

const MODE_SET = new Set<string>(TOOL_DISPLAY_MODES);

export function isToolDisplayMode(value: string): value is ToolDisplayMode {
  return MODE_SET.has(value);
}

export function parseToolDisplayMode(value: string | undefined): ToolDisplayMode | null {
  const v = value?.trim();
  if (!v || !isToolDisplayMode(v)) return null;
  return v;
}

export function resolveToolDisplayMode(
  meta: ConversationMetaLoadResult | null | undefined,
  config?: RuntimeConfig,
): ToolDisplayMode {
  if (meta != null && isConversationMeta(meta)) {
    const sessionMode = parseToolDisplayMode(
      typeof meta.gateway_tool_display === "string" ? meta.gateway_tool_display : undefined,
    );
    if (sessionMode) return sessionMode;
  }
  const gateway = asRecord(config?.gateway);
  const toolDisplay = gateway?.tool_display;
  const globalMode = parseToolDisplayMode(
    typeof toolDisplay === "string" ? toolDisplay : undefined,
  );
  return globalMode ?? DEFAULT_TOOL_DISPLAY_MODE;
}

const HANDOFF_DEFAULTS: Record<string, boolean> = {
  discord: true,
  weixin: false,
};

export function resolveConversationHandoffOnNew(platform: string, config?: RuntimeConfig): boolean {
  const section = asRecord(asRecord(config)?.[platform]);
  const handoff = section?.session_handoff_on_new;
  if (typeof handoff === "boolean") {
    return handoff;
  }
  return HANDOFF_DEFAULTS[platform] ?? true;
}

export function formatToolDisplayHelp(): string {
  return TOOL_DISPLAY_MODES.join(", ");
}
