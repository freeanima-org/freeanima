import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";

const HABITAT_LOCAL_SHELL_TOOLS = new Set(["terminal_run", "terminal_process", "code_execute"]);

/** 编码会话走开发机前哨，禁止落到栖息地本机 file_* / shell。 */
export function isCodingConversationMeta(
  meta: Pick<ConversationMetaMessage, "scenario" | "platform"> | undefined | null,
): boolean {
  if (!meta) return false;
  return meta.scenario === "coding_agent" || meta.platform === "coding";
}

/** 栖息地本机手（非 remote_* / mcp_* 前缀）。 */
export function isHabitatLocalHandTool(name: string): boolean {
  const n = name.trim();
  if (!n || n.startsWith("remote_") || n.startsWith("mcp_")) return false;
  if (n.startsWith("file_")) return true;
  return HABITAT_LOCAL_SHELL_TOOLS.has(n);
}

export function filterHabitatLocalHandsForCoding(
  toolNames: string[],
  meta: ConversationMetaMessage,
): string[] {
  if (!isCodingConversationMeta(meta)) return toolNames;
  return toolNames.filter((name) => !isHabitatLocalHandTool(name));
}
