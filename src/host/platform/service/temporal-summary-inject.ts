import type { BeforeLlmCallContext } from "@freeanima/host/core/hooks/loop";
import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { resolvePromptMode } from "@freeanima/host/core/hooks/prompt";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import { getConversationMeta, isCronSession } from "@freeanima/host/core/db/pg/conversation";
import { loadSelfLayerPrompt } from "@freeanima/host/capabilities/self";
import {
  injectTemporalPeerRollups,
  resolvePeerTimelineInjects,
  resolveTemporalSummaryConfig,
  stripTemporalSummaryPeersFromMessages,
} from "@freeanima/host/capabilities/memory/temporal-summary";
import { cacheGetJson, cacheSetJson } from "@freeanima/host/core/redis";

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
    if (meta != null && isConversationMeta(meta) && resolvePromptMode(meta.module) === "work") {
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
