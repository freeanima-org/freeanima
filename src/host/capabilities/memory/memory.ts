import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import { formatFtsToolError, isFtsQueryError } from "@freeanima/host/core/util";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { rememberFromArgs } from "./semantic-memory-tools.ts";
import { MEMORY_SEMANTIC_CITATION_TOOL_HINT } from "./memory-reference.ts";
import {
  isMemoryRecallHitType,
  memoryRecallSearch,
  type MemoryRecallHitType,
} from "./recall-search.ts";

function asFloat(value: unknown, defaultVal: number): number {
  if (value == null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

function parseMemoryTypes(value: unknown): MemoryRecallHitType[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return undefined;
  const out: MemoryRecallHitType[] = [];
  for (const item of value) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    if (!isMemoryRecallHitType(s)) return undefined;
    out.push(s);
  }
  return out.length > 0 ? out : undefined;
}

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated terms default to **OR** (any term may match)\n" +
  "- **AND** for stricter match: `preference AND concise`\n" +
  "- **OR** / **NOT**: `preference OR concise`, `Free NOT Anima`\n" +
  '- **Double quotes** for phrases / CJK tokens: `"Free Anima"`, `preference` (short CJK matches **adjacent** characters; long CJK uses bigram OR)';

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
          description:
            "Unified memory search: semantic memories, conversation messages, limbic memories, autobiographical narratives.\n" +
            "Related semantic memories are auto-injected before each user turn; use this for other memory types or deeper retrieval.\n" +
            "Cross-type reranking returns top N (default 10) in results; use memory_type to distinguish.\n" +
            "Optional memory_types filters which sources to search (default: all four).\n" +
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
                  'Search keywords. Default space=OR; use AND for strict match; CJK phrase proximity. Examples: "preference concise", "preference AND concise", "Free Anima"',
              },
              limit: { type: "number", description: "Max results, default 10, cap 20" },
              memory_types: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["semantic", "conversation", "limbic", "autobiographical"],
                },
                description:
                  'Restrict sources (default: all). Example: ["semantic"] for facts only',
              },
            },
            required: ["query"],
          },
          handler: async (args) => {
            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");

            const limit = Math.max(1, Math.min(20, asFloat(args.limit, 10)));
            const memory_types = parseMemoryTypes(args.memory_types);
            if (args.memory_types != null && memory_types === undefined) {
              return toolError(
                "memory_types must be an array of semantic|conversation|limbic|autobiographical",
              );
            }

            try {
              const result = await memoryRecallSearch(query, {
                limit,
                ...(memory_types ? { memory_types } : {}),
              });
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
