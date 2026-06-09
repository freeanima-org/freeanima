import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { toolError, toolResult } from "@freeanima/engine-tool";
import type { SelfBlockKey } from "@freeanima/engine-repos";
import { SELF_BLOCK_KEYS } from "@freeanima/engine-repos";

import { invalidateSelfLayerPromptCache } from "./cache.ts";
import { loadSelfBlocks, loadSelfLayerPrompt } from "./load.ts";
import { getSelfLayerStore } from "./port.ts";

function parseBlockKey(raw: unknown): SelfBlockKey | null {
  const key = String(raw ?? "").trim() as SelfBlockKey;
  return SELF_BLOCK_KEYS.includes(key) ? key : null;
}

export function registerSelfTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("self", "自我层六块读写", [
    {
      name: "get_self_blocks",
      description: "读取自我层六块（存在锚点、自我模型、人格基线、方向意图、元认知、自传概括）。",
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
      name: "update_self_block",
      description: "更新自我层指定块的内容。existence_anchor 默认 locked，需 force=true 才能修改。",
      parameters: {
        type: "object",
        properties: {
          block_key: {
            type: "string",
            description:
              "existence_anchor | self_model | personality_baseline | direction | metacognition | autobiography_summary",
          },
          content: { type: "string", description: "块正文（Markdown）" },
          force: {
            type: "boolean",
            description: "existence_anchor 等 locked 块是否强制更新",
          },
        },
        required: ["block_key", "content"],
      },
      handler: async (args) => {
        const blockKey = parseBlockKey(args.block_key);
        if (!blockKey) return toolError("invalid block_key");

        const content = String(args.content ?? "").trim();
        if (!content) return toolError("content is required");

        const force = args.force !== undefined ? Boolean(args.force) : false;

        try {
          const store = getSelfLayerStore();
          const existing = await store.getBlock(blockKey);
          if (existing) {
            await store.updateBlock(
              { block_key: blockKey, content, updated_by: "tool" },
              { force },
            );
          } else {
            await store.upsertBlock({
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
  ]);
}
