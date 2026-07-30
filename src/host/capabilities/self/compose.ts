import type { SelfBlockKey } from "@freeanima/host/core/db/schema";
import { selfBlockKeySchema } from "@freeanima/host/core/db/schema";

import type { SelfBlockRow } from "@freeanima/host/core/db/schema/rows";

import {
  SELF_BLOCK_EMPTY_PLACEHOLDER,
  SELF_BLOCK_HEADINGS,
  SELF_LAYER_CODE_FENCE_LANG,
  SELF_LAYER_PROMPT_HEADING,
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

/** Render five blocks as resident Markdown */
export function renderSelfLayerPrompt(blocks: SelfBlockRow[]): string {
  const lines: string[] = [];
  for (const row of blocks) {
    const block_key = selfBlockKeySchema.parse(row.block_key);
    const heading = SELF_BLOCK_HEADINGS[block_key];
    const body = row.content.trim() || SELF_BLOCK_EMPTY_PLACEHOLDER;
    lines.push(`## ${heading}`, body);
  }
  return lines.join("\n\n");
}

/** Wrap five-block Markdown as self-layer system prompt segment (second-person frame + code fence) */
export function wrapSelfLayerForSystemPrompt(innerMarkdown: string): string {
  const body = innerMarkdown.trim();
  if (!body) return "";
  const header = `${SELF_LAYER_SYSTEM_FRAME}\n\n## ${SELF_LAYER_PROMPT_HEADING}`;
  return `${header}\n\`\`\`${SELF_LAYER_CODE_FENCE_LANG}\n${body}\n\`\`\``;
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
