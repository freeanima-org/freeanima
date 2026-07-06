import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { formatFtsToolError, isFtsQueryError } from "@freeanima/core/util";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { rememberFromArgs } from "./semantic-memory-tools.ts";
import { MEMORY_SEMANTIC_CITATION_TOOL_HINT } from "./memory-reference.ts";
import { memoryRecallSearch } from "./recall-search.ts";

function asFloat(value: unknown, defaultVal: number): number {
  if (value == null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated terms default to **AND** (all must match)\n" +
  "- **OR** for broader recall: `preference OR concise` (becomes |)\n" +
  "- **AND** / **NOT**: `Free AND Anima`, `Free NOT Anima`\n" +
  '- **Double quotes** for phrases / CJK tokens: `"Free Anima"`, `preference` (CJK matches **adjacent** characters)';

export function registerMemoryCoreTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory",
    "Core memory recall and remember",
    attachToolReturns(
      [
        {
          name: "memory_remember",
          description:
            "Manage persistent semantic memories: create, update, or delete.\n" +
            "- Default action=create: add a memory (auto-infers source_conversations / observed_at)\n" +
            "- action=update: update by semantic_memory_id\n" +
            "- action=delete: physical delete by semantic_memory_id\n" +
            "pinned=true memories appear first in resident context.",
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
        {
          name: "memory_recall",
          exposeMcp: true,
          description:
            "Unified memory search: semantic memories, conversation messages, limbic memories, autobiographical narratives.\n" +
            "Related semantic memories are auto-injected before each user turn; use this for other memory types or deeper retrieval.\n" +
            "Cross-type reranking returns top N (default 10) in results; use memory_type to distinguish.\n" +
            "Session hits return snippets only; full context via conversation_scroll; in-conversation search via conversation_search.\n" +
            "Structured semantic filters via memory_semantic_search.\n\n" +
            FTS_SYNTAX +
            "\n\n" +
            MEMORY_SEMANTIC_CITATION_TOOL_HINT,
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  'Search keywords. Default space=AND; use OR for broad recall; CJK phrase proximity. Examples: "preference concise", "preference OR concise", "Free Anima"',
              },
              limit: { type: "number", description: "Max results, default 10, cap 20" },
            },
            required: ["query"],
          },
          handler: async (args) => {
            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");

            const limit = Math.max(1, Math.min(20, asFloat(args.limit, 10)));

            try {
              const result = await memoryRecallSearch(query, { limit });
              return toolResult(result);
            } catch (e) {
              if (isFtsQueryError(e)) return toolError(formatFtsToolError(e));
              throw e;
            }
          },
        },
      ],
      MEMORY_TOOL_RETURNS,
    ),
  );
}
