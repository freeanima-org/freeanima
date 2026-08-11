import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";

import {
  errMsg,
  type EmailToolIo,
  messagePayload,
  parseAccountId,
  parseMessageId,
  resolveEmailToolTagIds,
} from "./email-tool-helpers.ts";
import {
  getEmailMessageRow,
  listEmailMessages,
  searchEmailMessages,
  tagEmailMessage,
} from "./message-store.ts";
import { EMAIL_TOOL_RETURNS } from "./return-schemas.ts";
import { listEmailThreads, tagEmailThread } from "./thread-store.ts";
import { getEmailSyncPort } from "./sync-port.ts";
import { resolveEmailToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";

const MAILBOX_TOOL_NAMES = [
  "email_sync",
  "email_list",
  "email_search",
  "email_read",
  "email_mark_read",
  "email_mark_flagged",
  "email_mark_unflagged",
  "email_delete",
  "email_move",
  "email_send",
  "email_save_draft",
  "email_send_draft",
  "email_mailbox_list",
  "email_mailbox_create",
  "email_mailbox_rename",
  "email_mailbox_delete",
  "email_thread_list",
  "email_tag",
] as const;

export function registerEmailMailboxTools(toolSets: ToolSetRegistry, io: EmailToolIo): void {
  toolSets.registerToolSet(
    "email",
    "Email sync and mailbox (use toolset `email-account` to register accounts); world_id optional.",
    attachToolReturns(
      [
        {
          name: "email_sync",
          description: "Sync IMAP inbox into entity storage.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              account_id: { type: "number" },
              limit: { type: "number" },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            try {
              const sync = getEmailSyncPort();
              const accountId = parseAccountId(args.account_id);
              if (accountId != null) {
                const result = await sync.syncAccount(
                  accountId,
                  omitUndefined({
                    limit: args.limit != null ? Number(args.limit) : undefined,
                  }),
                );
                return toolResult(result);
              }
              const worldId = await resolveEmailToolWorld({ args, access: "write" });
              if (typeof worldId === "string") return worldId;

              const results = await sync.syncAll(
                omitUndefined({
                  worldId,
                  limit: args.limit != null ? Number(args.limit) : undefined,
                }),
              );
              return toolResult({ results });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_list",
          description: "List synced email messages from entity storage.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              account_id: { type: "number" },
              thread_id: { type: "number" },
              mailbox: { type: "string" },
              unread: { type: "boolean" },
              limit: { type: "number" },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            try {
              const accountId = parseAccountId(args.account_id);
              const worldId = await resolveEmailToolWorld({
                args,
                ...(accountId != null ? { accountId } : {}),
              });
              if (typeof worldId === "string") return worldId;

              const messages = await listEmailMessages(
                worldId,
                omitUndefined({
                  account_id: accountId,
                  thread_id: parseAccountId(args.thread_id),
                  imap_mailbox:
                    args.mailbox != null ? String(args.mailbox).trim() || undefined : undefined,
                  unread: args.unread != null ? Boolean(args.unread) : undefined,
                  limit: args.limit != null ? Number(args.limit) : undefined,
                }),
              );
              return toolResult({
                messages: await Promise.all(messages.map((m) => messagePayload(m))),
                count: messages.length,
              });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_search",
          description:
            "Search synced email messages. Query optional — omit for filter-only listing. Supports mailbox/to/subject/flagged/has_attachment/unread filters.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string" },
              account_id: { type: "number" },
              thread_id: { type: "number" },
              mailbox: { type: "string" },
              unread: { type: "boolean" },
              flagged: { type: "boolean" },
              has_attachment: { type: "boolean" },
              from: {
                type: "string",
                description: "Filter by sender address (substring match, case-insensitive).",
              },
              to: {
                type: "string",
                description: "Filter by recipient address (substring match, case-insensitive).",
              },
              subject: {
                type: "string",
                description: "Filter by subject/title (substring match, case-insensitive).",
              },
              sent_after: {
                type: "string",
                description: "ISO timestamp: only messages with sent_at >= this value.",
              },
              sent_before: {
                type: "string",
                description: "ISO timestamp: only messages with sent_at <= this value.",
              },
              limit: { type: "number" },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            const query = args.query != null ? String(args.query).trim() : "";
            try {
              const accountId = parseAccountId(args.account_id);
              const worldId = await resolveEmailToolWorld({
                args,
                ...(accountId != null ? { accountId } : {}),
              });
              if (typeof worldId === "string") return worldId;

              const messages = await searchEmailMessages(
                worldId,
                omitUndefined({
                  ...(query ? { query } : {}),
                  account_id: accountId,
                  thread_id: parseAccountId(args.thread_id),
                  mailbox:
                    args.mailbox != null ? String(args.mailbox).trim() || undefined : undefined,
                  unread: args.unread != null ? Boolean(args.unread) : undefined,
                  flagged: args.flagged != null ? Boolean(args.flagged) : undefined,
                  has_attachment:
                    args.has_attachment != null ? Boolean(args.has_attachment) : undefined,
                  from: args.from != null ? String(args.from).trim() || undefined : undefined,
                  to: args.to != null ? String(args.to).trim() || undefined : undefined,
                  subject:
                    args.subject != null ? String(args.subject).trim() || undefined : undefined,
                  since:
                    args.sent_after != null
                      ? String(args.sent_after).trim() || undefined
                      : undefined,
                  before:
                    args.sent_before != null
                      ? String(args.sent_before).trim() || undefined
                      : undefined,
                  limit: args.limit != null ? Number(args.limit) : undefined,
                }),
              );
              return toolResult({
                messages: await Promise.all(messages.map((m) => messagePayload(m))),
                count: messages.length,
              });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_read",
          description:
            "Read a synced email by entity id. Default body is plain text; set raw=true for decoded content raw (text/html or text/plain). Returns headers and attachment metadata.",
          parameters: {
            type: "object",
            properties: {
              message_id: { type: "number" },
              raw: {
                type: "boolean",
                description:
                  "If true, return decoded body content as stored (HTML or plain). Default returns plain text.",
              },
            },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              const message = await getEmailMessageRow(messageId);
              if (!message) return toolError(`Email message not found: ${messageId}`);
              return toolResult({
                message: await messagePayload(message, {
                  raw: args.raw === true,
                  includeHeaders: true,
                  includeAttachments: true,
                }),
              });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mark_read",
          description: "Mark a synced email as read (entity + IMAP).",
          parameters: {
            type: "object",
            properties: { message_id: { type: "number" } },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              return toolResult(await io.markAsRead(messageId));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mark_flagged",
          description: "Mark a synced email as flagged/starred (entity + IMAP).",
          parameters: {
            type: "object",
            properties: { message_id: { type: "number" } },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              const { markAsFlagged } =
                await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await markAsFlagged(messageId));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mark_unflagged",
          description: "Remove flagged/starred from a synced email (entity + IMAP).",
          parameters: {
            type: "object",
            properties: { message_id: { type: "number" } },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              const { markAsUnflagged } =
                await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await markAsUnflagged(messageId));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_move",
          description: "Move a synced email to another IMAP mailbox.",
          parameters: {
            type: "object",
            properties: {
              message_id: { type: "number" },
              target_mailbox: { type: "string" },
            },
            required: ["message_id", "target_mailbox"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            const targetMailbox = String(args.target_mailbox ?? "").trim();
            if (!targetMailbox) return toolError("target_mailbox is required");
            try {
              const { moveMessage } = await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await moveMessage(messageId, targetMailbox));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_delete",
          description: "Delete a synced email (entity + IMAP when applicable).",
          parameters: {
            type: "object",
            properties: { message_id: { type: "number" } },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              return toolResult(await io.deleteEmail(messageId));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_send",
          description: "Send email via a configured account.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              account_id: { type: "number" },
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
              cc: { type: "string" },
              bcc: { type: "string" },
              attachment_object_file_ids: {
                type: "array",
                items: { type: "number" },
                description:
                  "Optional object_file entity ids to attach (upload via object_storage_upload or email.attachment.upload first)",
              },
            },
            required: ["subject_kind", "to", "subject", "body"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            const worldId = await resolveEmailToolWorld({
              args,
              ...(accountId != null ? { accountId } : {}),
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            const subjectKind =
              args.subject_kind === "user" || args.subject_kind === "agent"
                ? args.subject_kind
                : undefined;
            const attachmentIds = Array.isArray(args.attachment_object_file_ids)
              ? args.attachment_object_file_ids
                  .map((id) => Number(id))
                  .filter((id) => Number.isFinite(id) && id > 0)
              : undefined;
            try {
              const result = await io.sendEmail(
                omitUndefined({
                  account_id: accountId,
                  subject_kind: subjectKind,
                  world_id: accountId == null ? worldId : undefined,
                  to: String(args.to ?? ""),
                  subject: String(args.subject ?? ""),
                  body: String(args.body ?? ""),
                  cc: args.cc != null ? String(args.cc) : undefined,
                  bcc: args.bcc != null ? String(args.bcc) : undefined,
                  attachment_object_file_ids: attachmentIds,
                }),
              );
              return toolResult(result);
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_save_draft",
          description: "Save or update a draft (APPEND to Drafts mailbox with \\Draft).",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              account_id: { type: "number" },
              message_id: { type: "number" },
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["subject_kind", "subject", "body"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            const worldId = await resolveEmailToolWorld({
              args,
              ...(accountId != null ? { accountId } : {}),
              access: "write",
            });
            if (typeof worldId === "string") return worldId;
            const subjectKind =
              args.subject_kind === "user" || args.subject_kind === "agent"
                ? args.subject_kind
                : undefined;
            try {
              const { saveDraft } = await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(
                await saveDraft(
                  omitUndefined({
                    account_id: accountId,
                    subject_kind: subjectKind,
                    world_id: accountId == null ? worldId : undefined,
                    message_id: parseAccountId(args.message_id),
                    to: args.to != null ? String(args.to) : undefined,
                    subject: String(args.subject ?? ""),
                    body: String(args.body ?? ""),
                  }),
                ),
              );
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_send_draft",
          description: "Send a saved draft via SMTP and remove it from Drafts.",
          parameters: {
            type: "object",
            properties: { message_id: { type: "number" } },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              const { sendDraft } = await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await sendDraft(messageId));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mailbox_list",
          description: "List IMAP mailboxes for an account.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "number" },
            },
            required: ["account_id"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            if (accountId == null) return toolError("account_id is required");
            try {
              const { listMailboxesForAccount } =
                await import("@freeanima/host/capabilities/connectors/email");
              const mailboxes = await listMailboxesForAccount(accountId);
              return toolResult({ mailboxes, count: mailboxes.length });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mailbox_create",
          description: "Create an IMAP mailbox.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "number" },
              path: { type: "string" },
            },
            required: ["account_id", "path"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            if (accountId == null) return toolError("account_id is required");
            const path = String(args.path ?? "").trim();
            if (!path) return toolError("path is required");
            try {
              const { createMailbox } =
                await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await createMailbox(accountId, path));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mailbox_rename",
          description: "Rename an IMAP mailbox.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "number" },
              from: { type: "string" },
              to: { type: "string" },
            },
            required: ["account_id", "from", "to"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            if (accountId == null) return toolError("account_id is required");
            const from = String(args.from ?? "").trim();
            const to = String(args.to ?? "").trim();
            if (!from || !to) return toolError("from and to are required");
            try {
              const { renameMailbox } =
                await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await renameMailbox(accountId, from, to));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mailbox_delete",
          description: "Delete an IMAP mailbox.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "number" },
              path: { type: "string" },
            },
            required: ["account_id", "path"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            if (accountId == null) return toolError("account_id is required");
            const path = String(args.path ?? "").trim();
            if (!path) return toolError("path is required");
            try {
              const { deleteMailbox } =
                await import("@freeanima/host/capabilities/connectors/email");
              return toolResult(await deleteMailbox(accountId, path));
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_thread_list",
          description: "List email threads for an account.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              account_id: { type: "number" },
              has_unread: { type: "boolean" },
              limit: { type: "number" },
            },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            try {
              const accountId = parseAccountId(args.account_id);
              const worldId = await resolveEmailToolWorld({
                args,
                ...(accountId != null ? { accountId } : {}),
              });
              if (typeof worldId === "string") return worldId;

              const threads = await listEmailThreads(
                worldId,
                omitUndefined({
                  account_id: accountId,
                  has_unread: args.has_unread != null ? Boolean(args.has_unread) : undefined,
                  limit: args.limit != null ? Number(args.limit) : undefined,
                }),
              );
              return toolResult({ threads, count: threads.length });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_tag",
          description:
            "Set tag_ids on an email thread or message. Pass tags (titles, find-or-create) and/or tag_ids.",
          parameters: {
            type: "object",
            properties: {
              target: { type: "string", enum: ["thread", "message"] },
              id: { type: "number" },
              tags: { type: "array", items: { type: "string" } },
              tag_ids: { type: "array", items: { type: "integer" } },
            },
            required: ["target", "id"],
          },
          handler: async (args) => {
            const id = parseMessageId(args.id);
            if (id == null) return toolError("id is required");
            const target = String(args.target ?? "");
            try {
              const worldId = await resolveEmailToolWorld({
                args,
                entityId: id,
                access: "write",
              });
              if (typeof worldId === "string") return worldId;
              const tagIds =
                (await resolveEmailToolTagIds(
                  worldId,
                  omitUndefined({
                    tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
                    tag_ids: Array.isArray(args.tag_ids)
                      ? args.tag_ids
                          .map((x) => Number(x))
                          .filter((n) => Number.isFinite(n) && n > 0)
                      : undefined,
                  }),
                )) ?? [];
              if (target === "thread") {
                const thread = await tagEmailThread(id, tagIds);
                if (!thread) return toolError(`Email thread not found: ${id}`);
                return toolResult({ ok: true, thread });
              }
              if (target === "message") {
                const message = await tagEmailMessage(id, tagIds);
                if (!message) return toolError(`Email message not found: ${id}`);
                return toolResult({ ok: true, message: await messagePayload(message) });
              }
              return toolError("target must be thread or message");
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
      ],
      Object.fromEntries(
        MAILBOX_TOOL_NAMES.map((name) => [name, EMAIL_TOOL_RETURNS[name]]),
      ) as Partial<typeof EMAIL_TOOL_RETURNS>,
    ),
  );
}
