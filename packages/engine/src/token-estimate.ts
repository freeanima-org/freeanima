/** 粗估 token（中英文混排约 3.5 字符/token） */
export function estimateTokens(text: string): number {
  const len = text.trim().length;
  if (!len) return 0;
  return Math.max(1, Math.ceil(len / 3.5));
}

export function messageTextForEstimate(msg: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof msg.content === "string") parts.push(msg.content);
  if (msg.tool_calls) parts.push(JSON.stringify(msg.tool_calls));
  if (typeof msg.reasoning_content === "string") parts.push(msg.reasoning_content);
  if (typeof msg.reasoning === "string") parts.push(msg.reasoning);
  if (typeof msg.name === "string") parts.push(msg.name);
  return parts.join("\n");
}

export function estimateMessagesTokens(messages: Record<string, unknown>[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(messageTextForEstimate(m)), 0);
}

export function estimateToolsTokens(tools: Record<string, unknown>[] | undefined): number {
  if (!tools?.length) return 0;
  return estimateTokens(JSON.stringify(tools));
}
