import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns } from "@freeanima/habitat/core/tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { rememberFromArgs } from "./semantic-memory-tools.ts";

export function registerMemoryCoreTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory",
    "Core memory remember",
    attachToolReturns(
      [
        {
          name: "memory_remember",
          description:
            "Manage persistent semantic memories: create, update, or delete.\n" +
            "- Default action=create: add a memory (auto-infers source_conversations / observed_at)\n" +
            "- action=update: update by semantic_memory_id\n" +
            "- action=delete: physical delete by semantic_memory_id\n" +
            "pinned=true memories appear first in resident context.\n" +
            "Search: memory_semantic_search (facts), content_block_search (emotion/narrative via component=limbic|narrative), " +
            "conversation_search (dialogue).",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description: "Operation: create (default) / update / delete",
                enum: ["create", "update", "delete"],
              },
              content: {
                type: "string",
                description:
                  "Memory content (one concise sentence); required for create and update",
              },
              semantic_memory_id: {
                type: "string",
                description: "Semantic memory ID; required for update or delete",
              },
              fact_id: {
                type: "string",
                description: "Alias for semantic_memory_id on update or delete",
              },
              type: {
                type: "string",
                description:
                  "Memory type: world/experience/opinion/observation/preference/procedural/imprint",
              },
              pinned: { type: "boolean", description: "Pin to resident memory" },
            },
            required: [],
          },
          handler: rememberFromArgs,
        },
      ],
      MEMORY_TOOL_RETURNS,
    ),
  );
}
