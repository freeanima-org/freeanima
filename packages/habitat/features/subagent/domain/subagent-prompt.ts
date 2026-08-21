import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import {
  SUBAGENT_PROMPT_INCLUDES,
  type SubagentPromptInclude,
} from "@freeanima/habitat/core/db/schema/entity/components/subagent.ts";
import { formatCstIsoFromEpoch } from "@freeanima/habitat/core/util";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";

import type { ResolvedSubagentProfile } from "./types.ts";

export function normalizePromptIncludes(
  raw: readonly string[] | undefined | null,
): SubagentPromptInclude[] {
  if (!raw?.length) return [];
  const allow = new Set<string>(SUBAGENT_PROMPT_INCLUDES);
  const out: SubagentPromptInclude[] = [];
  for (const item of raw) {
    const key = (item ?? "").trim().toLowerCase();
    if (!allow.has(key)) continue;
    const typed = assertNarrow<SubagentPromptInclude>(key);
    if (!out.includes(typed)) {
      out.push(typed);
    }
  }
  return out;
}

export function mergePromptIncludes(
  ...lists: Array<readonly SubagentPromptInclude[] | undefined>
): SubagentPromptInclude[] {
  const out: SubagentPromptInclude[] = [];
  for (const list of lists) {
    for (const item of normalizePromptIncludes(list)) {
      if (!out.includes(item)) out.push(item);
    }
  }
  return out;
}

/** 档案 / 临时指令 → 子 run 角色段（不含旁路；不含本次 goal） */
export function formatSubagentRoleSection(profile: ResolvedSubagentProfile): string {
  const role =
    profile.content.trim() ||
    (profile.kind === "ephemeral" ? "" : `You are subagent "${profile.title}" (${profile.slug}).`);
  return [role, profile.summary.trim() ? `Description: ${profile.summary.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
}

/** 本次任务目标 + 可选上下文（与角色分条） */
export function formatSubagentGoalSection(input: {
  slug: string;
  goal: string;
  context?: string;
}): string {
  return [
    `子任务（${input.slug}）`,
    input.goal.trim(),
    input.context?.trim() ? `\n上下文\n${input.context.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildSelfIncludeSection(): Promise<string> {
  const self = (
    await loadSelfLayerPrompt(getResolvedWorldContext().default_chat_agent_subject_id)
  ).trim();
  if (!self) return "";
  return `## Self\n${self}`;
}

function buildWorldIncludeSection(): string {
  try {
    const ctx = getResolvedWorldContext();
    return [
      "## World context",
      `- agent_subject_id: ${ctx.agent_subject_id}`,
      `- agent_world_id: ${ctx.agent_world_id}`,
      `- user_subject_id: ${ctx.user_subject_id}`,
      `- user_world_id: ${ctx.user_world_id}`,
      `- commons_world_id: ${ctx.commons_world_id}`,
    ].join("\n");
  } catch {
    return "";
  }
}

function buildTimeIncludeSection(): string {
  const now = Date.now();
  let tz = "UTC";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    /* ignore */
  }
  return `## Time\n- now: ${formatCstIsoFromEpoch(Math.floor(now / 1000))}\n- timezone: ${tz}`;
}

/** 按 opt-in 列表构建旁路段（默认空） */
export async function buildSubagentOptInSections(
  includes: readonly SubagentPromptInclude[],
): Promise<string[]> {
  const sections: string[] = [];
  for (const key of includes) {
    if (key === "self") {
      const s = await buildSelfIncludeSection();
      if (s) sections.push(s);
    } else if (key === "world") {
      const s = buildWorldIncludeSection();
      if (s) sections.push(s);
    } else if (key === "time") {
      sections.push(buildTimeIncludeSection());
    }
  }
  return sections;
}
