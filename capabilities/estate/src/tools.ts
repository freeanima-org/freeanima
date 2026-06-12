import type { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/mechanism-tool";
import { EMAIL_TOOL_RETURNS } from "./return-schemas.ts";

import type { EmailApi } from "./email-api.ts";
import { emailAccountInputSchema, emailAccountPatchSchema, emailFilterSchema } from "./types.ts";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerEmailTools(toolSets: ToolSetRegistry, email: EmailApi): void {
  toolSets.registerToolSet(
    "email",
    "Email accounts and send/receive",
    attachToolReturns(
      [
        {
          name: "email_register_account",
          description:
            'Register an email account in config.yaml. password supports plaintext, env("KEY"), or credential("path", "field").',
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "Account ID (unique in config)" },
              password: {
                type: "string",
                description: 'Password reference, e.g. credential("email/example", "password")',
              },
              address: { type: "string", description: "Email address" },
              display_name: { type: "string", description: "Sender display name" },
              smtp_host: { type: "string" },
              smtp_port: { type: "number" },
              imap_host: { type: "string" },
              imap_port: { type: "number" },
              default_sender: { type: "boolean", description: "Default outbound account" },
              enabled: { type: "boolean" },
              desc: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: [
              "id",
              "password",
              "address",
              "smtp_host",
              "smtp_port",
              "imap_host",
              "imap_port",
            ],
          },
          handler: async (args) => {
            try {
              const input = emailAccountInputSchema.parse(args);
              const account = await email.registerEmailAccount(input);
              return toolResult({ ok: true, account });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_edit_account",
          description:
            "Edit a registered email account (password may be updated to env/credential reference).",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string" },
              password: {
                type: "string",
                description: "Plaintext / env() / credential() reference",
              },
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
            const id = String(args.id ?? "").trim();
            if (!id) return toolError("id is required");
            try {
              const { id: _id, ...patch } = args;
              const account = email.editEmailAccount(id, emailAccountPatchSchema.parse(patch));
              return toolResult({ ok: true, account });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_list_accounts",
          description: "List email accounts in config.yaml (includes pass paths, not passwords).",
          parameters: { type: "object", properties: {} },
          handler: async () => {
            try {
              return toolResult({ accounts: email.listEmailAccounts() });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_delete_account",
          description: "Remove email account from config.yaml (does not delete pass credentials).",
          parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          },
          handler: async (args) => {
            const id = String(args.id ?? "").trim();
            if (!id) return toolError("id is required");
            try {
              email.deleteEmailAccount(id);
              return toolResult({ ok: true, id });
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
              account_id: {
                type: "string",
                description: "Sender account ID; default account if omitted",
              },
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
              const result = await email.sendEmail({
                account_id: args.account_id != null ? String(args.account_id) : undefined,
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
          name: "email_fetch",
          description: "Fetch recent email summaries from IMAP.",
          parameters: {
            type: "object",
            properties: {
              account_id: {
                type: "string",
                description: "Account ID; all enabled accounts if omitted",
              },
              limit: { type: "number", description: "Count, default 20" },
            },
          },
          handler: async (args) => {
            try {
              const messages = await email.fetchEmails(
                args.account_id != null ? String(args.account_id) : undefined,
                args.limit != null ? Number(args.limit) : undefined,
              );
              return toolResult({ messages, count: messages.length });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_list",
          description: "List IMAP email summaries with filters.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "string" },
              unread: { type: "boolean" },
              since: { type: "string", description: "ISO date or YYYY-MM-DD" },
              from: { type: "string" },
              subject: { type: "string", description: "Subject contains" },
              limit: { type: "number" },
            },
          },
          handler: async (args) => {
            try {
              const { account_id, ...filterArgs } = args;
              const filter = emailFilterSchema.parse(filterArgs);
              const messages = await email.listEmails(
                account_id != null ? String(account_id) : undefined,
                filter,
              );
              return toolResult({ messages, count: messages.length });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_read",
          description: "Read full body of a single email.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "string" },
              uid: { type: "number" },
            },
            required: ["account_id", "uid"],
          },
          handler: async (args) => {
            const accountId = String(args.account_id ?? "").trim();
            const uid = Number(args.uid);
            if (!accountId) return toolError("account_id is required");
            if (!Number.isFinite(uid)) return toolError("uid is required");
            try {
              const message = await email.readEmail(accountId, uid);
              return toolResult({ message });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_mark_read",
          description: "Mark an email as read.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "string" },
              uid: { type: "number" },
            },
            required: ["account_id", "uid"],
          },
          handler: async (args) => {
            const accountId = String(args.account_id ?? "").trim();
            const uid = Number(args.uid);
            if (!accountId) return toolError("account_id is required");
            if (!Number.isFinite(uid)) return toolError("uid is required");
            try {
              const result = await email.markAsRead(accountId, uid);
              return toolResult(result);
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_delete",
          description: "Delete an email from the IMAP mailbox.",
          parameters: {
            type: "object",
            properties: {
              account_id: { type: "string" },
              uid: { type: "number" },
            },
            required: ["account_id", "uid"],
          },
          handler: async (args) => {
            const accountId = String(args.account_id ?? "").trim();
            const uid = Number(args.uid);
            if (!accountId) return toolError("account_id is required");
            if (!Number.isFinite(uid)) return toolError("uid is required");
            try {
              const result = await email.deleteEmail(accountId, uid);
              return toolResult(result);
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
