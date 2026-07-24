import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";

import {
  errMsg,
  type EmailToolIo,
  messagePayload,
  parseAccountId,
  parseMessageId,
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
  "email_delete",
  "email_send",
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
              unread: { type: "boolean" },
              limit: { type: "number" },
            },
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
            "Hybrid search synced email messages. Optional from / sent_after / sent_before filters combine with query (AND).",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string" },
              account_id: { type: "number" },
              thread_id: { type: "number" },
              unread: { type: "boolean" },
              from: {
                type: "string",
                description: "Filter by sender address (substring match, case-insensitive).",
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
            required: ["query"],
          },
          handler: async (args) => {
            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");
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
                  query,
                  account_id: accountId,
                  thread_id: parseAccountId(args.thread_id),
                  unread: args.unread != null ? Boolean(args.unread) : undefined,
                  from: args.from != null ? String(args.from).trim() || undefined : undefined,
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
            },
            required: ["to", "subject", "body"],
          },
          handler: async (args) => {
            const accountId = parseAccountId(args.account_id);
            if (accountId != null) {
              const worldId = await resolveEmailToolWorld({
                args,
                accountId,
                access: "write",
              });
              if (typeof worldId === "string") return worldId;
            }
            try {
              const result = await io.sendEmail(
                omitUndefined({
                  account_id: accountId,
                  to: String(args.to ?? ""),
                  subject: String(args.subject ?? ""),
                  body: String(args.body ?? ""),
                  cc: args.cc != null ? String(args.cc) : undefined,
                  bcc: args.bcc != null ? String(args.bcc) : undefined,
                }),
              );
              return toolResult(result);
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
          description: "Set tags on an email thread or message entity.",
          parameters: {
            type: "object",
            properties: {
              target: { type: "string", enum: ["thread", "message"] },
              id: { type: "number" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["target", "id", "tags"],
          },
          handler: async (args) => {
            const id = parseMessageId(args.id);
            if (id == null) return toolError("id is required");
            const target = String(args.target ?? "");
            const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
            try {
              if (target === "thread") {
                const thread = await tagEmailThread(id, tags);
                if (!thread) return toolError(`Email thread not found: ${id}`);
                return toolResult({ ok: true, thread });
              }
              if (target === "message") {
                const message = await tagEmailMessage(id, tags);
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
