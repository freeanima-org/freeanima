import type { SelfBlockKey, SelfBlockRow, SelfLayerStorePort } from "@freeanima/engine-repos";
import { SELF_BLOCK_KEYS } from "@freeanima/engine-repos";

import {
  DEFAULT_EXISTENCE_ANCHOR,
  DEFAULT_METACOGNITION,
  SELF_BLOCK_EMPTY_PLACEHOLDER,
} from "./blocks.ts";
import { invalidateSelfLayerPromptCache } from "./cache.ts";
import { loadSoul } from "./soul.ts";

export type LegacyPinnedFact = {
  content: string;
  type: string;
};

export type SeedSelfLayerOpts = {
  store: SelfLayerStorePort;
  soulText?: string;
  pinnedFacts?: LegacyPinnedFact[];
};

const SECTION_MARKERS: Array<{ key: SelfBlockKey; patterns: RegExp[] }> = [
  { key: "existence_anchor", patterns: [/^##\s*存在锚点/im, /^#\s*存在锚点/im] },
  { key: "self_model", patterns: [/^##\s*自我模型/im] },
  { key: "personality_baseline", patterns: [/^##\s*人格基线/im, /^##\s*人格/im] },
  { key: "direction", patterns: [/^##\s*方向意图/im, /^##\s*方向/im] },
  { key: "metacognition", patterns: [/^##\s*元认知/im] },
  { key: "autobiography_summary", patterns: [/^##\s*自传概括/im, /^##\s*自传/im] },
];

function splitSoulSections(soulText: string): Partial<Record<SelfBlockKey, string>> {
  const text = soulText.trim();
  if (!text) return {};

  const matches: Array<{ key: SelfBlockKey; index: number; length: number }> = [];
  for (const marker of SECTION_MARKERS) {
    for (const pattern of marker.patterns) {
      const match = pattern.exec(text);
      if (match?.index != null) {
        matches.push({ key: marker.key, index: match.index, length: match[0].length });
        break;
      }
    }
  }
  matches.sort((a, b) => a.index - b.index);

  const out: Partial<Record<SelfBlockKey, string>> = {};
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const start = current.index + current.length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    out[current.key] = text.slice(start, end).trim();
  }

  if (!matches.length) {
    out.self_model = text;
  } else if (!out.self_model) {
    const beforeFirst = text.slice(0, matches[0]!.index).trim();
    if (beforeFirst) {
      out.self_model = [beforeFirst, out.self_model ?? ""].filter(Boolean).join("\n\n").trim();
    }
  }
  return out;
}

function matchPinnedByHint(facts: LegacyPinnedFact[], hints: RegExp[]): string[] {
  return facts
    .filter((fact) => hints.some((hint) => hint.test(fact.content)))
    .map((fact) => fact.content.trim())
    .filter(Boolean);
}

function buildPersonalityFromPinned(facts: LegacyPinnedFact[]): string {
  const lines = matchPinnedByHint(facts, [/风格|沟通|信任|冲突|人格|倾向/i]);
  const typed = facts
    .filter((fact) => fact.type === "preference" || fact.type === "opinion")
    .map((fact) => fact.content.trim())
    .filter(Boolean);
  const merged = [...new Set([...lines, ...typed])];
  return merged.map((line) => `- ${line}`).join("\n");
}

function buildDirectionFromPinned(facts: LegacyPinnedFact[]): string {
  const lines = matchPinnedByHint(facts, [/目标|方向|关注|成长|不做|意图/i]);
  return lines.map((line) => `- ${line}`).join("\n");
}

function hasBlockContent(row: SelfBlockRow | undefined): boolean {
  return Boolean(row?.content.trim());
}

export async function seedSelfLayerFromLegacy(opts: SeedSelfLayerOpts): Promise<{
  seeded: boolean;
  blocks_written: SelfBlockKey[];
}> {
  const soulText = (opts.soulText ?? loadSoul()).trim();
  const pinnedFacts = opts.pinnedFacts ?? [];
  const sections = splitSoulSections(soulText);
  const existing = await opts.store.listBlocks();
  const byKey = new Map(existing.map((row) => [row.block_key, row]));

  const planned: Partial<Record<SelfBlockKey, string>> = {};

  if (!hasBlockContent(byKey.get("existence_anchor"))) {
    planned.existence_anchor = sections.existence_anchor?.trim() || DEFAULT_EXISTENCE_ANCHOR;
  }
  if (!hasBlockContent(byKey.get("self_model"))) {
    planned.self_model = sections.self_model?.trim() || soulText;
  }
  if (!hasBlockContent(byKey.get("personality_baseline"))) {
    planned.personality_baseline =
      sections.personality_baseline?.trim() || buildPersonalityFromPinned(pinnedFacts);
  }
  if (!hasBlockContent(byKey.get("direction"))) {
    planned.direction = sections.direction?.trim() || buildDirectionFromPinned(pinnedFacts);
  }
  if (!hasBlockContent(byKey.get("metacognition"))) {
    planned.metacognition = sections.metacognition?.trim() || DEFAULT_METACOGNITION;
  }
  if (!hasBlockContent(byKey.get("autobiography_summary"))) {
    planned.autobiography_summary =
      sections.autobiography_summary?.trim() || SELF_BLOCK_EMPTY_PLACEHOLDER;
  }

  const blocksWritten: SelfBlockKey[] = [];
  for (const key of SELF_BLOCK_KEYS) {
    const content = planned[key]?.trim();
    if (!content) continue;
    const locked = key === "existence_anchor";
    await opts.store.upsertBlock({
      block_key: key,
      content,
      locked,
      updated_by: "seed",
    });
    blocksWritten.push(key);
  }

  if (blocksWritten.length > 0) {
    invalidateSelfLayerPromptCache();
  }

  return {
    seeded: blocksWritten.length > 0,
    blocks_written: blocksWritten,
  };
}

export async function ensureSelfLayerSeeded(opts: {
  store: SelfLayerStorePort;
  soulText?: string;
  pinnedFacts?: LegacyPinnedFact[];
}): Promise<void> {
  const initialized = await opts.store.isInitialized();
  const blocks = await opts.store.listBlocks();
  const allEmpty = blocks.every((row) => !row.content.trim());
  if (initialized && !allEmpty) return;
  await seedSelfLayerFromLegacy(opts);
}
