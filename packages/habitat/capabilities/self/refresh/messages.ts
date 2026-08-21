import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import {
  SELF_BLOCK_MAINTAINABLE_KEYS,
  type SelfBlockMaintainableKey,
} from "@freeanima/habitat/core/db/pg/self-layer/types";
import { formatMemoryReferenceMarker } from "@freeanima/habitat/core/db/pg/memory-reference/markers";
import {
  SELF_LAYER_MEMORY_FIELDS,
  renderSemanticMemoryList,
  toSemanticMemoryPromptItem,
} from "@freeanima/habitat/core/hooks/prompt";
import { SELF_BLOCK_HEADINGS } from "../blocks.ts";
import type { SelfBlockView } from "../compose.ts";
import { asRecord } from "@freeanima/shared/util";

export const SELF_LAYER_PROPOSAL_SOURCE_REF = "self-layer-proposal";
export const SELF_LAYER_PROPOSAL_TITLE = "自我层维护建议";

export const SELF_LAYER_REFRESH_INSTRUCTION = `You maintain a digital life's self layer (who I am), not episodic logs.

Evidence below is **high-survival resident semantic memory** only (pinned and/or highly referenced, status=active). Do **not** invent facts; cite evidence by <memory id> (JSON evidence_ids are those numeric ids).

Decide whether any of these four blocks should change:
- self_model
- personality_baseline
- direction
- metacognition

Rules:
1. Prefer **no change**. Only propose when multiple strong evidence items clearly support a durable shift.
2. Never propose changes to existence_anchor.
3. Proposed content must be first-person Markdown suitable to replace the whole block.
4. Respond with **JSON only** (no markdown fence), shape:
{"propose":false}
or
{"propose":true,"rationale":"short why","evidence_ids":[1,2],"blocks":{"self_model":"...optional...","personality_baseline":"...","direction":"...","metacognition":"..."}}
5. Include only blocks that actually need updates in "blocks".`;

export function formatEvidenceLines(facts: SemanticMemoryRow[]): string {
  if (facts.length === 0) return "(No resident semantic memory)";
  return renderSemanticMemoryList(facts.map(toSemanticMemoryPromptItem), {
    fields: SELF_LAYER_MEMORY_FIELDS,
  }).text;
}

export function formatMaintainableBlocks(views: SelfBlockView[]): string {
  const lines: string[] = [];
  for (const key of SELF_BLOCK_MAINTAINABLE_KEYS) {
    const view = views.find((v) => v.block_key === key);
    const body = view?.content.trim() || "(not set yet)";
    lines.push(`## ${SELF_BLOCK_HEADINGS[key]} (${key})`, body, "");
  }
  return lines.join("\n").trim();
}

/** 数据层：常驻证据 + 当前可维护自我块（不含任务指令） */
export function buildSelfLayerRefreshDataMessage(
  evidence: SemanticMemoryRow[],
  blocks: SelfBlockView[],
): string {
  return [
    "# Resident semantic evidence (pinned + high reference)",
    formatEvidenceLines(evidence),
    "",
    "# Current maintainable self-layer blocks",
    formatMaintainableBlocks(blocks),
  ].join("\n");
}

/** @deprecated 使用 SELF_LAYER_REFRESH_INSTRUCTION + buildSelfLayerRefreshDataMessage */
export function buildSelfLayerRefreshUserMessage(
  evidence: SemanticMemoryRow[],
  blocks: SelfBlockView[],
): string {
  return [
    buildSelfLayerRefreshDataMessage(evidence, blocks),
    "",
    SELF_LAYER_REFRESH_INSTRUCTION,
  ].join("\n");
}

export type SelfLayerProposalBlocks = Partial<Record<SelfBlockMaintainableKey, string>>;

export type SelfLayerProposalParsed =
  | { propose: false }
  | {
      propose: true;
      rationale: string;
      evidence_ids: number[];
      blocks: SelfLayerProposalBlocks;
    };

function isMaintainableKey(key: string): key is SelfBlockMaintainableKey {
  return (SELF_BLOCK_MAINTAINABLE_KEYS as readonly string[]).includes(key);
}

/** Parse LLM JSON; invalid / empty → no proposal */
export function parseSelfLayerRefreshResponse(raw: string): SelfLayerProposalParsed {
  const trimmed = raw.trim();
  if (!trimmed) return { propose: false };

  let text = trimmed;
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) text = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return { propose: false };
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return { propose: false };
    }
  }

  const obj = asRecord(parsed);
  if (!obj) return { propose: false };
  if (obj.propose !== true) return { propose: false };

  const blocksRaw = obj.blocks;
  if (!blocksRaw || typeof blocksRaw !== "object") return { propose: false };

  const blocks: SelfLayerProposalBlocks = {};
  const blocksRec = asRecord(blocksRaw);
  if (!blocksRec) return { propose: false };
  for (const [key, value] of Object.entries(blocksRec)) {
    if (!isMaintainableKey(key)) continue;
    if (typeof value !== "string") continue;
    const content = value.trim();
    if (!content) continue;
    blocks[key] = content;
  }

  if (Object.keys(blocks).length === 0) return { propose: false };

  const evidence_ids: number[] = [];
  if (Array.isArray(obj.evidence_ids)) {
    for (const id of obj.evidence_ids) {
      const n = typeof id === "number" ? id : Number(String(id).trim());
      if (Number.isInteger(n) && n > 0 && !evidence_ids.includes(n)) evidence_ids.push(n);
    }
  }

  const rationale =
    typeof obj.rationale === "string" && obj.rationale.trim()
      ? obj.rationale.trim()
      : "Evidence supports slow self-layer updates.";

  return { propose: true, rationale, evidence_ids, blocks };
}

export function formatProposalNotificationBody(
  proposal: Extract<SelfLayerProposalParsed, { propose: true }>,
): string {
  const blockLines: string[] = [];
  for (const key of SELF_BLOCK_MAINTAINABLE_KEYS) {
    const content = proposal.blocks[key];
    if (!content) continue;
    blockLines.push(`### ${SELF_BLOCK_HEADINGS[key]} (\`${key}\`)`, "", content, "");
  }

  const evidence =
    proposal.evidence_ids.length > 0
      ? proposal.evidence_ids.map((id) => formatMemoryReferenceMarker(id)).join(" ")
      : "(none listed)";

  return [
    "这是自我层慢维护建议（系统生成）。请在用户在场时征询是否采纳；**未获同意不要**调用 self_update_block。",
    "用户同意后按下列块全文覆盖写回；拒绝或暂缓则 mark_read 本通知且不写块。",
    "",
    `## 依据`,
    proposal.rationale,
    "",
    `## 证据`,
    evidence,
    "",
    `## 建议写回内容`,
    ...blockLines,
  ].join("\n");
}
