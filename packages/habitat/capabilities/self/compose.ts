import type { SelfBlockKey } from "@freeanima/habitat/core/db/schema";
import { selfBlockKeySchema } from "@freeanima/habitat/core/db/schema";

import type { SelfBlockRow } from "@freeanima/habitat/core/db/schema/rows";
import {
  PROMPT_XML_TAGS,
  wrapPromptXml,
  wrapPromptXmlSection,
} from "@freeanima/habitat/core/hooks/prompt";

import {
  SELF_BLOCK_EMPTY_PLACEHOLDER,
  SELF_BLOCK_HEADINGS,
  SELF_LAYER_SYSTEM_FRAME,
} from "./blocks.ts";

export type SelfBlockView = {
  block_key: SelfBlockKey;
  heading: string;
  content: string;
  locked: boolean;
  version: number;
};

export function toSelfBlockView(row: SelfBlockRow): SelfBlockView {
  const block_key = selfBlockKeySchema.parse(row.block_key);
  return {
    block_key,
    heading: SELF_BLOCK_HEADINGS[block_key],
    content: row.content.trim(),
    locked: row.locked,
    version: row.version,
  };
}

/** Render five blocks as nested XML (`<existence_anchor>…</existence_anchor>` …). */
export function renderSelfLayerPrompt(blocks: SelfBlockRow[]): string {
  const parts: string[] = [];
  for (const row of blocks) {
    const block_key = selfBlockKeySchema.parse(row.block_key);
    const body = row.content.trim() || SELF_BLOCK_EMPTY_PLACEHOLDER;
    const wrapped = wrapPromptXml(block_key, body);
    if (wrapped) parts.push(wrapped);
  }
  return parts.join("\n\n");
}

/** Outer frame + `<self_layer>` around nested block tags. */
export function wrapSelfLayerForSystemPrompt(innerXml: string): string {
  return wrapPromptXmlSection(PROMPT_XML_TAGS.selfLayer, innerXml, {
    frame: SELF_LAYER_SYSTEM_FRAME,
  });
}

export function composeSelfLayerPromptFromViews(views: SelfBlockView[]): string {
  return renderSelfLayerPrompt(
    views.map((view) => ({
      block_key: view.block_key,
      content: view.content,
      locked: view.locked,
      version: view.version,
      updated_by: null,
      created_at: new Date(0),
      updated_at: new Date(0),
    })),
  );
}
