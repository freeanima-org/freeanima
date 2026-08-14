import type { BeforeLlmCallContext } from "@freeanima/habitat/core/hooks/loop";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { resolveScenarioProfile } from "@freeanima/habitat/core/hooks/prompt";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { getConversationMeta, isCronSession } from "@freeanima/habitat/core/db/pg/conversation";
import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";
import {
  injectTemporalPeerRollups,
  resolvePeerTimelineInjects,
  resolveTemporalSummaryConfig,
  stripTemporalSummaryPeersFromMessages,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
import { cacheGetJson, cacheSetJson } from "@freeanima/habitat/core/redis";

/** Inject closed-bucket peer rollups into the message timeline (runtime-only). */
export function createTemporalPeerInjectHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripTemporalSummaryPeersFromMessages(ctx.messages);
    const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
    if (!config.enabled) return;

    const conversationId = ctx.conversationId.trim();
    if (!conversationId) return;
    if (await isCronSession(conversationId)) return;

    const meta = await getConversationMeta(conversationId);
    if (
      meta != null &&
      isConversationMeta(meta) &&
      resolveScenarioProfile(meta.scenario).prompt === "work"
    ) {
      return;
    }

    const selfContent = await loadSelfLayerPrompt();
    const injects = await resolvePeerTimelineInjects({
      viewerConversationId: conversationId,
      selfContent,
      config,
      peerCache: {
        getJson: cacheGetJson,
        setJson: cacheSetJson,
      },
    });
    if (injects.length === 0) return;
    injectTemporalPeerRollups(ctx.messages, injects);
  };
}
