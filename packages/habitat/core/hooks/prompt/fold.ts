import { walkHookChainOldestFirst, type HookStepLink } from "@freeanima/habitat/kernel/hooks";
import type { SystemPromptBuildEffect, SystemPromptSection } from "./hooks.ts";
import { truncatePromptBodyForXmlBudget, wrapPromptXmlSection } from "./xml-wrap.ts";

export type FoldSystemPromptOptions = {
  /** Global char budget after per-section caps; omit or <=0 = no global cap. */
  globalBudgetChars?: number;
  /** Section ids that must remain present (may still be truncated). */
  hardKeepIds?: readonly string[];
};

export type FoldSystemPromptResult = {
  text: string;
  /** Sections after budget application (content = final rendered text). */
  sections: SystemPromptSection[];
  truncatedSectionIds: string[];
  droppedSectionIds: string[];
};

const DEFAULT_HARD_KEEP = [
  "self",
  "anima-uri-protocol",
  "memory-citation",
  "memory-recall",
] as const;

const SECTION_BUDGET_MARKER = "\n\n[... truncated by section budget ...]";
const GLOBAL_BUDGET_MARKER = "\n\n[... truncated by global prompt budget ...]";

/** Render section: optional frame + XML wrap around body. */
export function materializeSystemPromptSection(section: SystemPromptSection): string {
  const body = section.content.trim();
  const tag = section.xmlTag?.trim();
  if (!tag) return body;
  return wrapPromptXmlSection(tag, body, {
    ...(section.xmlFrame ? { frame: section.xmlFrame } : {}),
    ...(section.xmlAttrs ? { attrs: section.xmlAttrs } : {}),
  });
}

function applySectionBudget(section: SystemPromptSection): {
  section: SystemPromptSection;
  truncated: boolean;
} {
  const budget = section.budgetChars;
  const tag = section.xmlTag?.trim();
  if (budget == null || budget <= 0) {
    return {
      section: { ...section, content: section.content.trim() },
      truncated: false,
    };
  }

  if (tag) {
    const { body, truncated } = truncatePromptBodyForXmlBudget(
      section.content,
      budget,
      {
        tag,
        ...(section.xmlFrame ? { frame: section.xmlFrame } : {}),
        ...(section.xmlAttrs ? { attrs: section.xmlAttrs } : {}),
      },
      SECTION_BUDGET_MARKER,
    );
    return {
      section: { ...section, content: body },
      truncated,
    };
  }

  const content = section.content.trim();
  if (content.length <= budget) {
    return { section: { ...section, content }, truncated: false };
  }
  const keep = Math.max(0, budget - SECTION_BUDGET_MARKER.length);
  return {
    section: { ...section, content: `${content.slice(0, keep)}${SECTION_BUDGET_MARKER}` },
    truncated: true,
  };
}

function sectionPriority(s: SystemPromptSection): number {
  return s.priority ?? 100;
}

function joinMaterializedLen(list: SystemPromptSection[]): number {
  return list.map((s) => materializeSystemPromptSection(s)).join("\n\n").length;
}

function finalizeSections(list: SystemPromptSection[]): SystemPromptSection[] {
  return list.map((s) => {
    const rendered = materializeSystemPromptSection(s);
    const { xmlTag: _t, xmlFrame: _f, xmlAttrs: _a, ...rest } = s;
    return { ...rest, content: rendered };
  });
}

/**
 * Merge hook sections by id (last write wins), apply per-section then global budgets.
 * Lower `priority` number = kept preferentially when over global budget.
 * Prefer truncating within a section over dropping entire sections.
 * When `xmlTag` is set, truncate the inner body then wrap (closing tags preserved).
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
    if (!raw.content.trim() && !raw.xmlTag) continue;
    const { section, truncated } = applySectionBudget(raw);
    if (!materializeSystemPromptSection(section).trim()) continue;
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

    while (joinMaterializedLen(working) > globalBudget && working.length > 0) {
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
      const overflow = joinMaterializedLen(working) - globalBudget;
      const tag = target.xmlTag?.trim();

      if (tag) {
        const { body, truncated } = truncatePromptBodyForXmlBudget(
          target.content,
          Math.max(0, materializeSystemPromptSection(target).length - overflow),
          {
            tag,
            ...(target.xmlFrame ? { frame: target.xmlFrame } : {}),
            ...(target.xmlAttrs ? { attrs: target.xmlAttrs } : {}),
          },
          GLOBAL_BUDGET_MARKER,
        );
        if (!body.trim() && !hardKeep.has(target.id)) {
          working.splice(targetIdx, 1);
          droppedSectionIds.push(target.id);
          continue;
        }
        if (body === target.content.trim() && !truncated) {
          // Cannot shrink further via body; drop if allowed
          if (!hardKeep.has(target.id)) {
            working.splice(targetIdx, 1);
            droppedSectionIds.push(target.id);
            continue;
          }
          break;
        }
        target.content = body;
        if (!truncatedSectionIds.includes(target.id)) truncatedSectionIds.push(target.id);
      } else {
        const marker = GLOBAL_BUDGET_MARKER;
        const newLen = Math.max(0, target.content.length - overflow - marker.length);
        if (newLen <= 0 && !hardKeep.has(target.id)) {
          working.splice(targetIdx, 1);
          droppedSectionIds.push(target.id);
          continue;
        }
        const cut = Math.max(hardKeep.has(target.id) ? 64 : 0, newLen);
        target.content = `${target.content.slice(0, cut)}${marker}`;
        if (!truncatedSectionIds.includes(target.id)) truncatedSectionIds.push(target.id);
        if (hardKeep.has(target.id) && cut <= 64) break;
      }

      if (joinMaterializedLen(working) <= globalBudget) break;
    }

    sections = working;
  }

  const finalized = finalizeSections(sections);
  const text = finalized.map((s) => s.content).join("\n\n");
  return { text, sections: finalized, truncatedSectionIds, droppedSectionIds };
}

export function foldSystemPromptSections(
  chain: HookStepLink<SystemPromptBuildEffect> | null,
  opts?: FoldSystemPromptOptions,
): string {
  return foldSystemPromptSectionsDetailed(chain, opts).text;
}
