import { getToolConversationId } from "@freeanima/core/tool";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult, type ToolArgs } from "@freeanima/core/tool";

import { getNotificationPort } from "./port.ts";
import { NOTIFICATION_TOOL_RETURNS } from "./return-schemas.ts";

const TARGETS = new Set(["user", "agent", "both"]);
const MARK_READ_MAX = 20;

function resolveTargets(raw: unknown): ("user" | "agent")[] | null {
  const target = String(raw ?? "both").trim();
  if (!TARGETS.has(target)) return null;
  if (target === "user") return ["user"];
  if (target === "agent") return ["agent"];
  return ["user", "agent"];
}

function resolveMarkReadIds(args: ToolArgs): string[] | null {
  const fromArray = Array.isArray(args.ids)
    ? args.ids.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const single = String(args.id ?? "").trim();
  const merged = [...new Set(single ? [single, ...fromArray] : fromArray)];
  if (merged.length === 0) return null;
  return merged.slice(0, MARK_READ_MAX);
}

export function registerNotificationTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "notification",
    "In-app notification inbox (user and agent subjects)",
    attachToolReturns(
      [
        {
          name: "notification_send",
          description:
            "Send an in-app notification to the configured user and/or agent subject. Agent inbox is also fed by cron/task scanners; do not send duplicate reminders to yourself.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Notification title" },
              body: { type: "string", description: "Notification body" },
              target: {
                type: "string",
                enum: ["user", "agent", "both"],
                description: "Recipient subject, default both",
              },
            },
            required: ["title", "body"],
          },
          handler: async (args: ToolArgs) => {
            const port = getNotificationPort();
            if (!port) return toolError("Notification port not available");

            const title = String(args.title ?? "").trim();
            const body = String(args.body ?? "").trim();
            if (!title) return toolError("title is required");
            if (!body) return toolError("body is required");

            const targets = resolveTargets(args.target);
            if (!targets) return toolError("target must be user, agent, or both");

            const conversationId = getToolConversationId();
            const sourceRef = conversationId
              ? `tool:${conversationId}:${Date.now()}`
              : `tool:${Date.now()}`;

            const created = [];
            for (const kind of targets) {
              const recipient =
                kind === "user" ? port.getUserRecipient() : port.getAgentRecipient();
              const row = await port.create({
                recipient_kind: recipient.kind,
                recipient_id: recipient.id,
                title,
                body,
                source_kind: "tool",
                source_ref: sourceRef,
              });
              created.push({
                id: row.id,
                recipient_kind: row.recipient_kind,
                recipient_id: row.recipient_id,
              });
            }

            return toolResult({ ok: true as const, notifications: created });
          },
        },
        {
          name: "notification_list",
          description:
            "List notifications for the agent or user inbox. Default recipient=agent, read_filter=unread. Use when the injected notification block is truncated or you need to re-check unread items.",
          parameters: {
            type: "object",
            properties: {
              recipient: {
                type: "string",
                enum: ["user", "agent"],
                description: "Which subject inbox, default agent",
              },
              read_filter: {
                type: "string",
                enum: ["all", "unread"],
                description: "Filter by read state, default unread",
              },
              limit: { type: "number", description: "Max rows, default 20" },
            },
            required: [],
          },
          handler: async (args: ToolArgs) => {
            const port = getNotificationPort();
            if (!port) return toolError("Notification port not available");

            const recipientKind = String(args.recipient ?? "agent").trim();
            if (recipientKind !== "user" && recipientKind !== "agent") {
              return toolError("recipient must be user or agent");
            }

            const recipient =
              recipientKind === "user" ? port.getUserRecipient() : port.getAgentRecipient();
            const readFilter = String(args.read_filter ?? "unread").trim();
            if (readFilter !== "all" && readFilter !== "unread") {
              return toolError("read_filter must be all or unread");
            }

            const limitRaw = args.limit;
            const limit =
              typeof limitRaw === "number" && Number.isFinite(limitRaw)
                ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
                : 20;

            const items = await port.list({
              recipient_kind: recipient.kind,
              recipient_id: recipient.id,
              read_filter: readFilter,
              limit,
            });

            return toolResult({
              ok: true as const,
              items: items.map((row) => ({
                id: row.id,
                title: row.title,
                body: row.body,
                read_at: row.read_at,
                created_at: row.created_at,
                source_kind: row.source_kind,
                source_ref: row.source_ref,
              })),
            });
          },
        },
        {
          name: "notification_mark_read",
          description:
            "Mark notification(s) as read. Use id for one item or ids for batch (max 20). Batch-mark informational-only items after acknowledging. Mark a single id only after you finished handling it. Do not mark items awaiting user approval to proceed.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "Single notification id" },
              ids: {
                type: "array",
                items: { type: "string" },
                description: "Batch notification ids (informational-only ack)",
              },
            },
            required: [],
          },
          handler: async (args: ToolArgs) => {
            const port = getNotificationPort();
            if (!port) return toolError("Notification port not available");

            const ids = resolveMarkReadIds(args);
            if (!ids?.length) return toolError("id or ids is required");

            const marked: { id: string; read_at: string | null }[] = [];
            const failed: { id: string; error: string }[] = [];

            for (const id of ids) {
              try {
                const row = await port.markRead(id);
                if (!row) {
                  failed.push({ id, error: "not found" });
                  continue;
                }
                marked.push({
                  id: row.id,
                  read_at:
                    row.read_at instanceof Date
                      ? row.read_at.toISOString()
                      : row.read_at != null
                        ? String(row.read_at)
                        : null,
                });
              } catch (e) {
                failed.push({ id, error: e instanceof Error ? e.message : String(e) });
              }
            }

            if (marked.length === 0) {
              return toolError(`No notifications marked read (${failed.length} failed)`);
            }

            return toolResult({
              ok: true as const,
              marked,
              failed,
            });
          },
        },
      ],
      NOTIFICATION_TOOL_RETURNS,
    ),
  );
}

/** @internal exported for unit tests */
export { resolveMarkReadIds };
