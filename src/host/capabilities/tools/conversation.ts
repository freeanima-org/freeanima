import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import {
  conversationExists,
  countMessages,
  findMessagePos,
  listMessageRowsFromPos,
  listMessageRowsPage,
  searchMessagesFts,
} from "@freeanima/host/core/db/pg/conversation";
import {
  attachToolReturns,
  toolError,
  toolResult,
  type ToolSetRegistry,
} from "@freeanima/host/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import {
  formatStoredMessageSearchHit,
  formatFtsToolError,
  isFtsQueryError,
  omitUndefined,
} from "@freeanima/host/core/util";

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated words default to **OR** (any word may match)\n" +
  "- **AND** for stricter match: `Free AND Anima`\n" +
  "- **OR** / **NOT**: `preference OR concise`, `Free NOT Anima`\n" +
  '- **Quotes** for phrases / CJK: `"Free Anima"`, `preference` (short CJK = character **proximity**; long CJK = bigram OR)';

function asInt(value: unknown, defaultVal: number, min: number, max: number): number {
  if (value == null || value === undefined) return defaultVal;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function registerConversationTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "conversation",
    "Historical conversation search and paginated reading",
    attachToolReturns(
      [
        {
          name: "conversation_search",
          description:
            "Search historical conversations (PostgreSQL messages full-text index).\n" +
            "Returns matching keyword snippets, not full message body; optional conversation scope.\n" +
            "Use conversation_scroll to load full context.\n\n" +
            FTS_SYNTAX,
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search keywords. Default space=OR; use AND for strict match",
              },
              session: {
                type: "string",
                description: "Optional: search only within specified conversation id",
              },
              limit: { type: "number", description: "Max results, default 10" },
            },
            required: ["query"],
          },
          handler: async (args) => {
            if (!isPostgresPrimary()) return toolError("PostgreSQL not configured");

            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");

            const limit = asInt(args.limit, 10, 1, 50);
            const conversationId = String(args.session ?? "").trim() || undefined;
            try {
              const rows = await searchMessagesFts(
                query,
                omitUndefined({
                  conversation_id: conversationId,
                  limit,
                }),
              );
              const hits = rows.map((r) => formatStoredMessageSearchHit(query, r));

              return toolResult({
                query,
                hits,
                summary:
                  hits.length > 0
                    ? `Found ${hits.length} historical conversations`
                    : `No historical conversations matching '${query}'`,
              });
            } catch (e) {
              if (isFtsQueryError(e)) return toolError(formatFtsToolError(e));
              throw e;
            }
          },
        },
        {
          name: "conversation_scroll",
          description:
            "Paginated reading of historical messages in specified conversation (user/assistant full content; tool messages truncated).\n" +
            "Use message_id (from memory_recall or conversation_search) as anchor to read forward; otherwise paginate with offset.",
          parameters: {
            type: "object",
            properties: {
              conversation_id: { type: "string", description: "session id" },
              message_id: {
                type: "string",
                description: "Optional: anchor message id, takes precedence over offset",
              },
              offset: {
                type: "number",
                description: "Pagination offset (by pos order), default 0",
              },
              limit: { type: "number", description: "Items per page, default 20" },
            },
            required: ["conversation_id"],
          },
          handler: async (args) => {
            if (!isPostgresPrimary()) return toolError("PostgreSQL not configured");

            const conversationId = String(args.conversation_id ?? "").trim();
            if (!conversationId) return toolError("conversation_id is required");
            if (!(await conversationExists(conversationId))) {
              return toolError(`session not found: ${conversationId}`);
            }

            const limit = asInt(args.limit, 20, 1, 100);
            const messageId = String(args.message_id ?? "").trim();
            const total = await countMessages(conversationId);

            let messages;
            let offset: number;
            if (messageId) {
              const pos = await findMessagePos(conversationId, messageId);
              if (pos == null) return toolError(`message not found: ${messageId}`);
              messages = await listMessageRowsFromPos(conversationId, pos, limit);
              offset = Math.max(0, pos - 1);
            } else {
              offset = asInt(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
              messages = await listMessageRowsPage(conversationId, offset, limit);
            }

            return toolResult({
              conversation_id: conversationId,
              messages,
              total,
              offset,
              limit,
            });
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
