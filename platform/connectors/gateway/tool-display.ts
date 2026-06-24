import type { ConversationMetaLoadResult } from "@freeanima/core/db/domain";
import { isConversationMeta } from "@freeanima/core/db/domain";
import type { AnimaConfig } from "@freeanima/core/config";

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
  config?: AnimaConfig,
): ToolDisplayMode {
  if (meta != null && isConversationMeta(meta)) {
    const sessionMode = parseToolDisplayMode(
      typeof meta.gateway_tool_display === "string" ? meta.gateway_tool_display : undefined,
    );
    if (sessionMode) return sessionMode;
  }
  const gateway = config?.gateway as { tool_display?: string } | undefined;
  const globalMode = parseToolDisplayMode(gateway?.tool_display);
  return globalMode ?? DEFAULT_TOOL_DISPLAY_MODE;
}

const HANDOFF_DEFAULTS: Record<string, boolean> = {
  discord: true,
  weixin: false,
};

export function resolveConversationHandoffOnNew(platform: string, config?: AnimaConfig): boolean {
  const section = config?.[platform as keyof AnimaConfig] as
    | { session_handoff_on_new?: boolean }
    | undefined;
  if (typeof section?.session_handoff_on_new === "boolean") {
    return section.session_handoff_on_new;
  }
  return HANDOFF_DEFAULTS[platform] ?? true;
}

export function formatToolDisplayHelp(): string {
  return TOOL_DISPLAY_MODES.join(", ");
}
