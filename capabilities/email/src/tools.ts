import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult, z } from "@freeanima/core/tool";

import {
  createEmailAccount,
  deleteEmailAccountRow,
  listEmailAccountRows,
  updateEmailAccount,
} from "./account-store.ts";
import {
  getEmailMessageRow,
  listEmailMessages,
  searchEmailMessages,
  tagEmailMessage,
} from "./message-store.ts";
import { listEmailThreads, tagEmailThread } from "./thread-store.ts";
import { getEmailSyncPort } from "./sync-port.ts";
import { EMAIL_TOOL_RETURNS } from "./return-schemas.ts";

const accountCreateSchema = z.object({
  password: z.string().min(1),
  address: z.string().email(),
  display_name: z.string().optional(),
  smtp_host: z.string().min(1),
  smtp_port: z.number().int().positive(),
  imap_host: z.string().min(1),
  imap_port: z.number().int().positive(),
  default_sender: z.boolean().optional(),
  enabled: z.boolean().optional(),
  desc: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const accountPatchSchema = accountCreateSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z.string().min(1).optional(),
  });

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function accountPayload(account: Awaited<ReturnType<typeof listEmailAccountRows>>[number]) {
  return {
    id: account.id,
    address: account.address,
    display_name: account.display_name,
    smtp_host: account.smtp_host,
    smtp_port: account.smtp_port,
    imap_host: account.imap_host,
    imap_port: account.imap_port,
    default_sender: account.default_sender,
    enabled: account.enabled,
    desc: account.desc,
    tags: account.tags,
    password: account.password,
    sync: account.sync,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

function messagePayload(message: NonNullable<Awaited<ReturnType<typeof getEmailMessageRow>>>) {
  return {
    id: message.id,
    account_id: message.account_id,
    thread_id: message.thread_id,
    subject: message.subject,
    preview: message.preview,
    body: message.body,
    from: message.from,
    to: message.to,
    cc: message.cc,
    sent_at: message.sent_at,
    unread: message.unread,
    direction: message.direction,
    imap_uid: message.imap_uid,
    tags: message.tags,
  };
}

function parseAccountId(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

function parseMessageId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function registerEmailTools(
  toolSets: ToolSetRegistry,
  io: {
    sendEmail: (input: {
      account_id?: number;
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }) => Promise<unknown>;
    markAsRead: (messageId: number) => Promise<unknown>;
    deleteEmail: (messageId: number) => Promise<unknown>;
    assertPasswordResolvable: (account: { password: string }) => Promise<void>;
  },
): void {
  toolSets.registerToolSet(
    "email",
    "Email accounts, sync, and send/receive via entity storage",
    attachToolReturns(
      [
        {
          name: "email_register_account",
          description:
            'Register an email account as entity. password supports plaintext, env("KEY"), or credential("path", "field").',
          parameters: {
            type: "object",
            properties: {
              password: { type: "string" },
              address: { type: "string" },
              display_name: { type: "string" },
              smtp_host: { type: "string" },
              smtp_port: { type: "number" },
              imap_host: { type: "string" },
              imap_port: { type: "number" },
              default_sender: { type: "boolean" },
              enabled: { type: "boolean" },
              desc: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["password", "address", "smtp_host", "smtp_port", "imap_host", "imap_port"],
          },
          handler: async (args) => {
            try {
              const input = accountCreateSchema.parse(args);
              await io.assertPasswordResolvable({ password: input.password });
              const account = await createEmailAccount(input);
              return toolResult({ ok: true, account: accountPayload(account) });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_edit_account",
          description: "Edit a registered email account entity.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "number" },
              password: { type: "string" },
              address: { type: "string" },
              display_name: { type: "string" },
              smtp_host: { type: "string" },
              smtp_port: { type: "number" },
              imap_host: { type: "string" },
              imap_port: { type: "number" },
              default_sender: { type: "boolean" },
              enabled: { type: "boolean" },
              desc: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["id"],
          },
          handler: async (args) => {
            const id = parseMessageId(args.id);
            if (id == null) return toolError("id is required");
            try {
              const patch = accountPatchSchema.parse(args);
              if (patch.password) await io.assertPasswordResolvable({ password: patch.password });
              const account = await updateEmailAccount({ id, ...patch });
              if (!account) return toolError(`Email account not found: ${id}`);
              return toolResult({ ok: true, account: accountPayload(account) });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_list_accounts",
          description: "List email account entities.",
          parameters: { type: "object", properties: {} },
          handler: async () => {
            try {
              const accounts = await listEmailAccountRows();
              return toolResult({ accounts: accounts.map(accountPayload) });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_delete_account",
          description: "Delete an email account entity.",
          parameters: {
            type: "object",
            properties: { id: { type: "number" } },
            required: ["id"],
          },
          handler: async (args) => {
            const id = parseMessageId(args.id);
            if (id == null) return toolError("id is required");
            try {
              const ok = await deleteEmailAccountRow(id);
              if (!ok) return toolError(`Email account not found: ${id}`);
              return toolResult({ ok: true, id });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_sync",
          description: "Sync IMAP inbox into entity storage.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "number" },
              limit: { type: "number" },
            },
          },
          handler: async (args) => {
            try {
              const sync = getEmailSyncPort();
              const accountId = parseAccountId(args.account_id);
              if (accountId != null) {
                const result = await sync.syncAccount(accountId, {
                  limit: args.limit != null ? Number(args.limit) : undefined,
                });
                return toolResult(result);
              }
              const results = await sync.syncAll({
                limit: args.limit != null ? Number(args.limit) : undefined,
              });
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
              account_id: { type: "number" },
              thread_id: { type: "number" },
              unread: { type: "boolean" },
              limit: { type: "number" },
            },
          },
          handler: async (args) => {
            try {
              const messages = await listEmailMessages({
                account_id: parseAccountId(args.account_id),
                thread_id: parseAccountId(args.thread_id),
                unread: args.unread != null ? Boolean(args.unread) : undefined,
                limit: args.limit != null ? Number(args.limit) : undefined,
              });
              return toolResult({
                messages: messages.map((m) => messagePayload(m)),
                count: messages.length,
              });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_search",
          description: "Hybrid search synced email messages.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              account_id: { type: "number" },
              thread_id: { type: "number" },
              unread: { type: "boolean" },
              limit: { type: "number" },
            },
            required: ["query"],
          },
          handler: async (args) => {
            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");
            try {
              const messages = await searchEmailMessages({
                query,
                account_id: parseAccountId(args.account_id),
                thread_id: parseAccountId(args.thread_id),
                unread: args.unread != null ? Boolean(args.unread) : undefined,
                limit: args.limit != null ? Number(args.limit) : undefined,
              });
              return toolResult({
                messages: messages.map((m) => messagePayload(m)),
                count: messages.length,
              });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_read",
          description: "Read a synced email message by entity id.",
          parameters: {
            type: "object",
            properties: { message_id: { type: "number" } },
            required: ["message_id"],
          },
          handler: async (args) => {
            const messageId = parseMessageId(args.message_id);
            if (messageId == null) return toolError("message_id is required");
            try {
              const message = await getEmailMessageRow(messageId);
              if (!message) return toolError(`Email message not found: ${messageId}`);
              return toolResult({ message: messagePayload(message) });
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
            try {
              const result = await io.sendEmail({
                account_id: parseAccountId(args.account_id),
                to: String(args.to ?? ""),
                subject: String(args.subject ?? ""),
                body: String(args.body ?? ""),
                cc: args.cc != null ? String(args.cc) : undefined,
                bcc: args.bcc != null ? String(args.bcc) : undefined,
              });
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
              account_id: { type: "number" },
              has_unread: { type: "boolean" },
              limit: { type: "number" },
            },
          },
          handler: async (args) => {
            try {
              const threads = await listEmailThreads({
                account_id: parseAccountId(args.account_id),
                has_unread: args.has_unread != null ? Boolean(args.has_unread) : undefined,
                limit: args.limit != null ? Number(args.limit) : undefined,
              });
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
                return toolResult({ ok: true, message: messagePayload(message) });
              }
              return toolError("target must be thread or message");
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
      ],
      EMAIL_TOOL_RETURNS,
    ),
  );
}
