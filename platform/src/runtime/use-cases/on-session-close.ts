import { generateSessionHandoffSummary } from "@freeanima/runtime/conversation";
import { logComponent } from "@freeanima/platform/logging";
import type { RuntimeDeps } from "../runtime-deps.ts";

/** Before closing old session via /new etc.: read-only handoff summary (does not write old session) */
export async function onSessionCloseBeforeNew(
  deps: RuntimeDeps,
  sessionId: string,
): Promise<string | null> {
  const result = await generateSessionHandoffSummary(deps.engine.repos, sessionId);
  if (result.ok) return result.summary;
  if (result.error !== "No conversation content") {
    logComponent("session-close").warn(`handoff summary failed: ${sessionId}`, {
      err: result.error,
    });
  }
  return null;
}
