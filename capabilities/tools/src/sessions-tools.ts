import { getToolRepos } from "@freeanima/core/tool";
import {
  attachToolReturns,
  toolError,
  toolResult,
  type ToolSetRegistry,
} from "@freeanima/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { formatSessionMessageSearchHit } from "@freeanima/core/util";

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated words default to **AND** (all must match)\n" +
  "- **OR** for broad recall: `preference OR concise` (becomes |)\n" +
  "- **AND** / **NOT**: `Free AND Anima`, `Free NOT Anima`\n" +
  '- **Quotes** for phrases / CJK: `"Free Anima"`, `preference` (CJK matches by character **proximity**)';

function asInt(value: unknown, defaultVal: number, min: number, max: number): number {
  if (value === null || value === undefined) return defaultVal;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function requireSessionStore():
  | { ok: true; store: NonNullable<ReturnType<typeof getToolRepos>>["session"] }
  | { ok: false; error: string } {
  const repos = getToolRepos();
  if (!repos) return { ok: false, error: "No repos context" };
  return { ok: true, store: repos.session };
}

export function registerSessionTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "sessions",
    "Historical conversation search and paginated reading",
    attachToolReturns(
      [
        {
          name: "sessions_search",
          description:
            "Search historical conversations (PostgreSQL messages full-text index).\n" +
            "Returns matching keyword snippets, not full message body; optional session scope.\n" +
            "Use sessions_scroll to load full context.\n\n" +
            FTS_SYNTAX,
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search keywords. Default space=AND; use OR for broad recall",
              },
              session: {
                type: "string",
                description: "Optional: search only within specified session id",
              },
              limit: { type: "number", description: "Max results, default 10" },
            },
            required: ["query"],
          },
          handler: async (args) => {
            const ctx = requireSessionStore();
            if (!ctx.ok) return toolError(ctx.error);

            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");

            const limit = asInt(args.limit, 10, 1, 50);
            const sessionId = String(args.session ?? "").trim() || undefined;
            const rows = await ctx.store.searchMessagesFts(query, { sessionId, limit });
            const hits = rows.map((r) => formatSessionMessageSearchHit(query, r));

            return toolResult({
              query,
              hits,
              summary: hits.length
                ? `Found ${hits.length} historical conversations`
                : `No historical conversations matching '${query}'`,
            });
          },
        },
        {
          name: "sessions_scroll",
          description:
            "Paginated reading of historical messages in specified session (user/assistant full content; tool messages truncated).\n" +
            "Use message_id (from memory_recall or sessions_search) as anchor to read forward; otherwise paginate with offset.",
          parameters: {
            type: "object",
            properties: {
              session_id: { type: "string", description: "session id" },
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
            required: ["session_id"],
          },
          handler: async (args) => {
            const ctx = requireSessionStore();
            if (!ctx.ok) return toolError(ctx.error);

            const sessionId = String(args.session_id ?? "").trim();
            if (!sessionId) return toolError("session_id is required");
            if (!(await ctx.store.sessionExists(sessionId))) {
              return toolError(`session not found: ${sessionId}`);
            }

            const limit = asInt(args.limit, 20, 1, 100);
            const messageId = String(args.message_id ?? "").trim();
            const total = await ctx.store.countMessages(sessionId);

            let messages;
            let offset: number;
            if (messageId) {
              const pos = await ctx.store.findMessagePos(sessionId, messageId);
              if (pos == null) return toolError(`message not found: ${messageId}`);
              messages = await ctx.store.listMessageRowsFromPos(sessionId, pos, limit);
              offset = Math.max(0, pos - 1);
            } else {
              offset = asInt(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
              messages = await ctx.store.listMessageRowsPage(sessionId, offset, limit);
            }

            return toolResult({
              session_id: sessionId,
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
