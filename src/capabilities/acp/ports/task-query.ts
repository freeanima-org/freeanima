import type { AcpPromptResult } from "../prompt-result.ts";

/** Optional read-only port for resolving persisted ACP progress/result text (wired in service). */
export type AcpTaskQueryPort = {
  getMessageContent(animaSessionId: string, messageId: string): Promise<string | null>;
  findAcpResultForTask(animaSessionId: string, taskId: string): Promise<AcpPromptResult | null>;
};
