import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import { SELF_TOOL_RETURNS } from "./return-schemas.ts";
import type { SelfBlockKey } from "@freeanima/host/core/db/pg/self-layer/types";
import { SELF_BLOCK_KEYS } from "@freeanima/host/core/db/pg/self-layer/types";
import {
  getSelfBlock,
  updateSelfBlock,
  upsertSelfBlock,
} from "@freeanima/host/core/db/pg/self-layer";

import { invalidateSelfLayerPromptCache } from "./cache.ts";
import { loadSelfBlocks, loadSelfLayerPrompt } from "./load.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

function parseBlockKey(raw: unknown): SelfBlockKey | null {
  const key = coerceString(raw ?? "").trim() as SelfBlockKey;
  return SELF_BLOCK_KEYS.includes(key) ? key : null;
}

export function registerSelfTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "self",
    "Self layer five blocks (read/write)",
    attachToolReturns(
      [
        {
          name: "self_get_blocks",
          description:
            "Read self layer five blocks (existence anchor, self model, personality baseline, direction, metacognition).",
          parameters: {
            type: "object",
            properties: {},
          },
          handler: async () => {
            try {
              const blocks = await loadSelfBlocks();
              return toolResult({ blocks });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : String(err));
            }
          },
        },
        {
          name: "self_update_block",
          description:
            "Update a self layer block. existence_anchor is locked by default; use force=true to override. For Inbox self-layer maintenance proposals (source_ref=self-layer-proposal), ask the user first; only write after they approve, then notification_mark_read.",
          parameters: {
            type: "object",
            properties: {
              block_key: {
                type: "string",
                description:
                  "existence_anchor | self_model | personality_baseline | direction | metacognition",
              },
              content: { type: "string", description: "Block body (Markdown)" },
              force: {
                type: "boolean",
                description: "Force update locked blocks such as existence_anchor",
              },
            },
            required: ["block_key", "content"],
          },
          handler: async (args) => {
            const blockKey = parseBlockKey(args.block_key);
            if (!blockKey) return toolError("invalid block_key");

            const content = coerceString(args.content ?? "").trim();
            if (!content) return toolError("content is required");

            const force = args.force !== undefined ? Boolean(args.force) : false;

            try {
              const existing = await getSelfBlock(blockKey);
              if (existing) {
                await updateSelfBlock(
                  { block_key: blockKey, content, updated_by: "tool" },
                  { force },
                );
              } else {
                await upsertSelfBlock({
                  block_key: blockKey,
                  content,
                  locked: blockKey === "existence_anchor",
                  updated_by: "tool",
                });
              }
              invalidateSelfLayerPromptCache();
              await loadSelfLayerPrompt();
              return toolResult({ ok: true, block_key: blockKey });
            } catch (err) {
              return toolError(err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
      SELF_TOOL_RETURNS,
    ),
  );
}
