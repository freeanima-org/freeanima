import { getNotificationPort } from "@freeanima/habitat/capabilities/tools/notification";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import type {
  SoftFailureNotifyFn,
  SoftFailureNotifyInput,
  SoftFailureNotifyResult,
} from "@freeanima/habitat/core/soft-failure";

/**
 * Platform binding: dual Inbox (user+agent) with source_ref dedupe.
 * Call sites use {@link notifySoftFailure} from core after registerSoftFailureNotify.
 */
export const deliverSoftFailureNotify: SoftFailureNotifyFn = async (
  input: SoftFailureNotifyInput,
): Promise<SoftFailureNotifyResult> => {
  const port = getNotificationPort();
  if (!port) return "skipped";

  const sourceRef = input.sourceRef;
  const audience = input.audience ?? "both";
  const user = port.getUserRecipient();
  const agent = port.getAgentRecipient();
  const wantUser = audience === "both" || audience === "user";
  const wantAgent = audience === "both" || audience === "agent";

  const [userExists, agentExists] = await Promise.all([
    wantUser ? port.existsBySourceRef(sourceRef, user) : Promise.resolve(true),
    wantAgent ? port.existsBySourceRef(sourceRef, agent) : Promise.resolve(true),
  ]);
  if (userExists && agentExists) return "deduped";

  const { title, body } = input;
  const payload = input.payload ?? { kind: "soft_failure" };

  try {
    if (wantUser && !userExists) {
      await port.create({
        recipient_kind: user.kind,
        recipient_id: user.id,
        title,
        body,
        source_kind: "system",
        source_ref: sourceRef,
        payload,
      });
    }
    if (wantAgent && !agentExists) {
      await port.create({
        recipient_kind: agent.kind,
        recipient_id: agent.id,
        title,
        body,
        source_kind: "system",
        source_ref: sourceRef,
        payload,
      });
    }
    return "notified";
  } catch (e) {
    logComponent("system").warn("soft failure notify failed", {
      error: e instanceof Error ? e.message : String(e),
      source_ref: sourceRef,
      label: input.logLabel ?? null,
    });
    return "skipped";
  }
};
