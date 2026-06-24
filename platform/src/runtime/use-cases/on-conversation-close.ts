import { generateConversationHandoffSummary } from "@freeanima/runtime/conversation";
import { logComponent } from "@freeanima/platform/logging";
import type { RuntimeDeps } from "../runtime-deps.ts";

/** Before closing old conversation via /new etc.: read-only handoff summary (does not write old conversation) */
export async function onConversationCloseBeforeNew(
  deps: RuntimeDeps,
  conversationId: string,
): Promise<string | null> {
  const result = await generateConversationHandoffSummary(deps.engine.repos, conversationId);
  if (result.ok) return result.summary;
  if (result.error !== "No conversation content") {
    logComponent("conversation-close").warn(`handoff summary failed: ${conversationId}`, {
      err: result.error,
    });
  }
  return null;
}
