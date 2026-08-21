import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { listResidentSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { purgeOrphanSelfBlocks } from "@freeanima/habitat/core/db/pg/self-layer";
import { listEntities } from "@freeanima/habitat/core/db/pg/entity";
import { isSubjectEnabled } from "@freeanima/habitat/core/config/resolved-world-context.ts";
import { getNotificationPort } from "@freeanima/habitat/capabilities/tools/notification";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { invalidateSelfLayerPromptCache } from "../cache.ts";
import { loadSelfBlocks } from "../load.ts";
import { runSelfLayerRefreshEngine } from "../refresh-engine-port.ts";
import {
  buildSelfLayerRefreshDataMessage,
  formatProposalNotificationBody,
  parseSelfLayerRefreshResponse,
  SELF_LAYER_PROPOSAL_SOURCE_REF,
  SELF_LAYER_PROPOSAL_TITLE,
  SELF_LAYER_REFRESH_INSTRUCTION,
} from "./messages.ts";

export type SelfLayerRefreshResult = {
  ok: boolean;
  proposed: boolean;
  notification_id?: string;
  evidence_count: number;
  summary: string;
  skipped?: string;
};

export type RunSelfLayerRefreshOpts = {
  agent_subject_id: number;
  /** @deprecated 忽略；自我正文作数据层，不再作对话 system */
  selfContent?: string;
};

async function hasUnreadProposal(agentSubjectId: number): Promise<boolean> {
  const port = getNotificationPort();
  if (!port) return false;
  const items = await port.list({
    recipient_kind: "agent",
    recipient_id: agentSubjectId,
    read_filter: "unread",
    limit: 50,
  });
  return items.some((row) => row.source_ref === SELF_LAYER_PROPOSAL_SOURCE_REF);
}

/** Slow self-layer maintenance for one agent: propose updates into that agent Inbox. */
export async function runSelfLayerRefresh(
  opts: RunSelfLayerRefreshOpts,
): Promise<SelfLayerRefreshResult> {
  void opts.selfContent;
  const agentSubjectId = opts.agent_subject_id;
  try {
    await purgeOrphanSelfBlocks(agentSubjectId);
  } catch (err) {
    logComponent("self").warn("purge orphan self blocks failed", {
      error: err instanceof Error ? err.message : String(err),
      agent_subject_id: agentSubjectId,
    });
  }

  invalidateSelfLayerPromptCache(agentSubjectId);

  if (await hasUnreadProposal(agentSubjectId)) {
    const result: SelfLayerRefreshResult = {
      ok: true,
      proposed: false,
      evidence_count: 0,
      summary: "Unread self-layer proposal already pending",
      skipped: "pending_proposal",
    };
    logComponent("self").info("self-layer refresh skipped", result);
    return result;
  }

  const evidence = await listResidentSemanticMemory();
  if (evidence.length === 0) {
    const result: SelfLayerRefreshResult = {
      ok: true,
      proposed: false,
      evidence_count: 0,
      summary: "No resident semantic memory; skipping self-layer refresh",
      skipped: "no_evidence",
    };
    logComponent("self").info("self-layer refresh skipped", result);
    return result;
  }

  const blocks = await loadSelfBlocks(agentSubjectId);
  const userMessage = buildSelfLayerRefreshDataMessage(evidence, blocks);

  logComponent("self").info("self-layer refresh LLM started", {
    evidence_count: evidence.length,
    agent_subject_id: agentSubjectId,
  });

  const generated = await runSelfLayerRefreshEngine({
    systemPrompt: SELF_LAYER_REFRESH_INSTRUCTION,
    userMessage,
    agent_subject_id: agentSubjectId,
  });
  const parsed = parseSelfLayerRefreshResponse(generated.content);

  if (!parsed.propose) {
    const result: SelfLayerRefreshResult = {
      ok: true,
      proposed: false,
      evidence_count: evidence.length,
      summary: "No self-layer changes warranted",
      skipped: "no_change",
    };
    logComponent("self").info("self-layer refresh completed", result);
    return result;
  }

  const port = getNotificationPort();
  if (!port) {
    return {
      ok: false,
      proposed: false,
      evidence_count: evidence.length,
      summary: "Notification port not available; cannot deliver self-layer proposal",
    };
  }

  const body = formatProposalNotificationBody(parsed);
  const row = await port.create({
    recipient_kind: "agent",
    recipient_id: agentSubjectId,
    title: SELF_LAYER_PROPOSAL_TITLE,
    body,
    source_kind: "system",
    source_ref: SELF_LAYER_PROPOSAL_SOURCE_REF,
    payload: {
      kind: "self_layer_proposal",
      agent_subject_id: agentSubjectId,
      rationale: parsed.rationale,
      evidence_ids: parsed.evidence_ids,
      blocks: parsed.blocks,
    },
  });

  const result: SelfLayerRefreshResult = omitUndefined({
    ok: true,
    proposed: true,
    notification_id: row.id,
    evidence_count: evidence.length,
    summary: `Proposed self-layer updates (${Object.keys(parsed.blocks).join(", ")})`,
  });
  logComponent("self").info("self-layer refresh proposed", result);
  return result;
}

/** Pipeline：对所有 enabled agent 各跑一轮 */
export async function runSelfLayerRefreshAllAgents(): Promise<SelfLayerRefreshResult> {
  const agents = await listEntities({ type: "agent", limit: 200 });
  const enabled = agents.filter((row) => isSubjectEnabled(row.body));
  if (enabled.length === 0) {
    return {
      ok: true,
      proposed: false,
      evidence_count: 0,
      summary: "No enabled agents",
      skipped: "no_agents",
    };
  }
  let anyProposed = false;
  let last: SelfLayerRefreshResult | null = null;
  for (const agent of enabled) {
    last = await runSelfLayerRefresh({ agent_subject_id: agent.id });
    if (last.proposed) anyProposed = true;
  }
  return (
    last ?? {
      ok: true,
      proposed: anyProposed,
      evidence_count: 0,
      summary: "done",
    }
  );
}
