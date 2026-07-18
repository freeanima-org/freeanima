import type { BeforeLlmCallContext } from "@freeanima/core/hooks/loop";
import { getActiveRuntimeConfig } from "@freeanima/core/config";
import { isCronSession } from "@freeanima/core/db/pg/conversation";
import { loadSelfLayerPrompt } from "@freeanima/capabilities/identity";
import {
  injectTemporalPeerRollups,
  resolvePeerTimelineInjects,
  resolveTemporalSummaryConfig,
  stripTemporalSummaryPeersFromMessages,
} from "@freeanima/capabilities/memory/temporal-summary";
import { cacheGetJson, cacheSetJson } from "@freeanima/platform/connectors/redis";

/** Inject closed-bucket peer rollups into the message timeline (runtime-only). */
export function createTemporalPeerInjectHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripTemporalSummaryPeersFromMessages(ctx.messages);
    const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
    if (!config.enabled) return;

    const conversationId = ctx.conversationId.trim();
    if (!conversationId) return;
    if (await isCronSession(conversationId)) return;

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
