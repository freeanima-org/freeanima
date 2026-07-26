import { getToolConversationId } from "@freeanima/host/core/tool";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult, type ToolArgs } from "@freeanima/host/core/tool";

import { getNotificationPort } from "./port.ts";
import { NOTIFICATION_TOOL_RETURNS } from "./return-schemas.ts";
import {
  resolveNotificationListSubject,
  resolveNotificationSendTargets,
  SUBJECT_ID_TOOL_PROPERTY,
} from "./tool-subject-resolve.ts";

const MARK_READ_MAX = 20;

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
    "In-app notification inbox (user and agent subjects). Task due/reminder cron feeds the user inbox — do not duplicate with notification_send.",
    attachToolReturns(
      [
        {
          name: "notification_send",
          description:
            "Send an in-app notification to the configured user and/or agent subject. Task due/reminder cron routes by task world; do not send duplicate task reminders.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Notification title" },
              body: { type: "string", description: "Notification body" },
              subject_id: SUBJECT_ID_TOOL_PROPERTY,
              target: {
                type: "string",
                enum: ["user", "agent", "both"],
                description:
                  "Recipient subject when subject_id omitted (required unless subject_id)",
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

            const targets = await resolveNotificationSendTargets(args);
            if (typeof targets === "string") return targets;

            const conversationId = getToolConversationId();
            const sourceRef = conversationId
              ? `tool:${conversationId}:${Date.now()}`
              : `tool:${Date.now()}`;

            const created = [];
            for (const recipient of targets) {
              const row = await port.create({
                recipient_kind: recipient.recipient_kind,
                recipient_id: recipient.recipient_id,
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
            "List notifications for the agent or user inbox. recipient or subject_id required; read_filter defaults to unread. Use when the injected notification block is truncated or you need to re-check unread items.",
          parameters: {
            type: "object",
            properties: {
              subject_id: SUBJECT_ID_TOOL_PROPERTY,
              recipient: {
                type: "string",
                enum: ["user", "agent"],
                description:
                  "Which subject inbox when subject_id omitted (required unless subject_id)",
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

            const recipient = await resolveNotificationListSubject(args);
            if (typeof recipient === "string") return recipient;

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
              recipient_kind: recipient.recipient_kind,
              recipient_id: recipient.recipient_id,
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
