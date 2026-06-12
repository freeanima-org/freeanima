import type { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/mechanism-tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { semanticMemoryToolDefs, rememberFromArgs } from "./semantic-memory-tools.ts";
import { autobiographicalMemoryToolDefs } from "./autobiographical-tools.ts";
import { limbicMemoryToolDefs } from "./limbic-tools.ts";
import { memoryRecallSearch } from "./recall-search.ts";

function asFloat(value: unknown, defaultVal: number): number {
  if (value === null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated terms default to **AND** (all must match)\n" +
  "- **OR** for broader recall: `preference OR concise` (becomes |)\n" +
  "- **AND** / **NOT**: `Free AND Anima`, `Free NOT Anima`\n" +
  '- **Double quotes** for phrases / CJK tokens: `"Free Anima"`, `preference` (CJK matches **adjacent** characters)';

export function registerMemoryTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory",
    "Memory search and management",
    attachToolReturns(
      [
        ...semanticMemoryToolDefs,
        ...autobiographicalMemoryToolDefs,
        ...limbicMemoryToolDefs,
        {
          name: "memory_remember",
          description:
            "Manage persistent semantic memories: create, update, or delete.\n" +
            "- Default action=create: add a memory (auto-infers source_sessions / observed_at)\n" +
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
          description:
            "Unified memory search: semantic memories, session messages, limbic memories, autobiographical narratives.\n" +
            "Cross-type reranking returns top N (default 10) in results; use memory_type to distinguish.\n" +
            "Session hits return snippets only; full context via sessions_scroll; in-session search via sessions_search.\n" +
            "Structured semantic filters via memory_semantic_search.\n\n" +
            FTS_SYNTAX,
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

            const result = await memoryRecallSearch(query, { limit });
            return toolResult(result);
          },
        },
      ],
      MEMORY_TOOL_RETURNS,
    ),
  );
}
