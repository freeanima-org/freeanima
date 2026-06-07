import type { SelfBlockKey, SelfBlockRow } from "@freeanima/engine-repos";

import { SELF_BLOCK_EMPTY_PLACEHOLDER, SELF_BLOCK_HEADINGS } from "./blocks.ts";

export type SelfBlockView = {
  block_key: SelfBlockKey;
  heading: string;
  content: string;
  locked: boolean;
  version: number;
};

export function toSelfBlockView(row: SelfBlockRow): SelfBlockView {
  return {
    block_key: row.block_key,
    heading: SELF_BLOCK_HEADINGS[row.block_key],
    content: row.content.trim(),
    locked: row.locked,
    version: row.version,
  };
}

/** 将六块渲染为常驻 Markdown */
export function renderSelfLayerPrompt(blocks: SelfBlockRow[]): string {
  const lines: string[] = [];
  for (const row of blocks) {
    const heading = SELF_BLOCK_HEADINGS[row.block_key];
    const body = row.content.trim() || SELF_BLOCK_EMPTY_PLACEHOLDER;
    lines.push(`## ${heading}`, body);
  }
  return lines.join("\n\n");
}

export function composeSelfLayerPromptFromViews(views: SelfBlockView[]): string {
  return renderSelfLayerPrompt(
    views.map((view) => ({
      block_key: view.block_key,
      content: view.content,
      locked: view.locked,
      version: view.version,
      updated_by: null,
      created: "",
      updated: "",
    })),
  );
}
