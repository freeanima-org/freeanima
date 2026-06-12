import { generateSessionHandoffSummary } from "@freeanima/orchestration-conversation";
import { getServiceContext } from "@freeanima/service-api";
import { logComponent } from "@freeanima/service-logging";

/** Before closing old session via /new etc.: read-only handoff summary (does not write old session) */
export async function onSessionCloseBeforeNew(sessionId: string): Promise<string | null> {
  const { engine } = getServiceContext();
  const result = await generateSessionHandoffSummary(engine.repos, sessionId);
  if (result.ok) return result.summary;
  if (result.error !== "No conversation content") {
    logComponent("session-close").warn(`handoff summary failed: ${sessionId}`, {
      err: result.error,
    });
  }
  return null;
}
