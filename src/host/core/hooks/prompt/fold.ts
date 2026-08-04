import { walkHookChainOldestFirst, type HookStepLink } from "@freeanima/host/kernel/hooks";
import type { SystemPromptBuildEffect, SystemPromptSection } from "./hooks.ts";

export type FoldSystemPromptOptions = {
  /** Global char budget after per-section caps; omit or <=0 = no global cap. */
  globalBudgetChars?: number;
  /** Section ids that must remain present (may still be truncated). */
  hardKeepIds?: readonly string[];
};

export type FoldSystemPromptResult = {
  text: string;
  /** Sections after budget application (debug / llm_debug). */
  sections: SystemPromptSection[];
  truncatedSectionIds: string[];
  droppedSectionIds: string[];
};

const DEFAULT_HARD_KEEP = ["self", "memory-citation", "memory-recall"] as const;

function applySectionBudget(section: SystemPromptSection): {
  section: SystemPromptSection;
  truncated: boolean;
} {
  const content = section.content.trim();
  const budget = section.budgetChars;
  if (budget == null || budget <= 0 || content.length <= budget) {
    return { section: { ...section, content }, truncated: false };
  }
  const marker = "\n\n[... truncated by section budget ...]";
  const keep = Math.max(0, budget - marker.length);
  return {
    section: { ...section, content: `${content.slice(0, keep)}${marker}` },
    truncated: true,
  };
}

function sectionPriority(s: SystemPromptSection): number {
  return s.priority ?? 100;
}

function joinSectionContentsLen(list: SystemPromptSection[]): number {
  return list.map((s) => s.content).join("\n\n").length;
}

/**
 * Merge hook sections by id (last write wins), apply per-section then global budgets.
 * Lower `priority` number = kept preferentially when over global budget.
 * Prefer truncating within a section over dropping entire sections.
 */
export function foldSystemPromptSectionsDetailed(
  chain: HookStepLink<SystemPromptBuildEffect> | null,
  opts?: FoldSystemPromptOptions,
): FoldSystemPromptResult {
  const byId = new Map<string, SystemPromptSection>();
  for (const step of walkHookChainOldestFirst(chain)) {
    if (step.status !== "ok" || !step.data?.sections?.length) continue;
    for (const section of step.data.sections) {
      byId.set(section.id, section);
    }
  }

  const truncatedSectionIds: string[] = [];
  const afterSectionBudget: SystemPromptSection[] = [];
  for (const raw of byId.values()) {
    if (!raw.content.trim()) continue;
    const { section, truncated } = applySectionBudget(raw);
    if (truncated) truncatedSectionIds.push(section.id);
    afterSectionBudget.push(section);
  }

  afterSectionBudget.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const hardKeep = new Set(opts?.hardKeepIds ?? DEFAULT_HARD_KEEP);
  const globalBudget = opts?.globalBudgetChars;
  const droppedSectionIds: string[] = [];

  let sections = afterSectionBudget;
  if (globalBudget != null && globalBudget > 0) {
    const working = [...sections];

    // Prefer within-section truncation (highest priority number first; hardKeep last).
    while (joinSectionContentsLen(working) > globalBudget && working.length > 0) {
      let targetIdx = working.length - 1;
      let worstPri = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < working.length; i++) {
        const s = working[i];
        if (!s) continue;
        const pri = sectionPriority(s);
        const effective = hardKeep.has(s.id) ? pri - 1000 : pri;
        if (effective > worstPri) {
          worstPri = effective;
          targetIdx = i;
        }
      }
      const target = working[targetIdx];
      if (!target) break;
      const overflow = joinSectionContentsLen(working) - globalBudget;
      const marker = "\n\n[... truncated by global prompt budget ...]";
      const newLen = Math.max(0, target.content.length - overflow - marker.length);
      if (newLen <= 0 && !hardKeep.has(target.id)) {
        working.splice(targetIdx, 1);
        droppedSectionIds.push(target.id);
        continue;
      }
      const cut = Math.max(hardKeep.has(target.id) ? 64 : 0, newLen);
      target.content = `${target.content.slice(0, cut)}${marker}`;
      if (!truncatedSectionIds.includes(target.id)) truncatedSectionIds.push(target.id);
      if (joinSectionContentsLen(working) <= globalBudget) break;
      if (hardKeep.has(target.id) && cut <= 64) break;
    }

    sections = working;
  }

  const text = sections.map((s) => s.content).join("\n\n");
  return { text, sections, truncatedSectionIds, droppedSectionIds };
}

export function foldSystemPromptSections(
  chain: HookStepLink<SystemPromptBuildEffect> | null,
  opts?: FoldSystemPromptOptions,
): string {
  return foldSystemPromptSectionsDetailed(chain, opts).text;
}
