import { countTokens } from "@freeanima/habitat/core/tokenizer";

export function messageTextForEstimate(msg: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof msg.content === "string") parts.push(msg.content);
  if (msg.tool_calls) parts.push(JSON.stringify(msg.tool_calls));
  if (typeof msg.reasoning === "string") parts.push(msg.reasoning);
  if (typeof msg.name === "string") parts.push(msg.name);
  return parts.join("\n");
}

export function estimateTokens(text: string, model?: string): number {
  return countTokens(text, model ?? "");
}

export function estimateMessagesTokens(
  messages: Record<string, unknown>[],
  model?: string,
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(messageTextForEstimate(m), model), 0);
}

export function estimateToolsTokens(
  tools: Record<string, unknown>[] | undefined,
  model?: string,
): number {
  if (!tools?.length) return 0;
  return estimateTokens(JSON.stringify(tools), model);
}
