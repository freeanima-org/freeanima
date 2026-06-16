/** @deprecated use default-session-toolsets.ts */
export {
  DEFAULT_SESSION_TOOLSETS as DEFAULT_SESSION_TOOL_NAMES,
  resolveDefaultSessionToolsets as resolveDefaultSessionTools,
} from "./default-session-toolsets.ts";

export const TOOLS_DISCOVERY_NAMES = ["toolsets_search", "toolsets_load"] as const;

export type DefaultSessionToolName = (typeof TOOLS_DISCOVERY_NAMES)[number];
