import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { omitUndefined } from "@freeanima/core/util";

import {
  createEmailAccount,
  deleteEmailAccountRow,
  listEmailAccountRows,
  updateEmailAccount,
} from "./account-store.ts";
import { resolveEmailWorldId } from "./email-world.ts";
import {
  accountCreateSchema,
  accountPatchSchema,
  accountPayload,
  errMsg,
  type EmailToolIo,
  parseMessageId,
} from "./email-tool-helpers.ts";
import { EMAIL_TOOL_RETURNS } from "./return-schemas.ts";

const ACCOUNT_TOOL_NAMES = [
  "email_register_account",
  "email_edit_account",
  "email_list_accounts",
  "email_delete_account",
] as const;

export function registerEmailAccountTools(toolSets: ToolSetRegistry, io: EmailToolIo): void {
  toolSets.registerToolSet(
    "email-account",
    "Email account setup (load toolset `email` for sync and mailbox ops)",
    attachToolReturns(
      [
        {
          name: "email_register_account",
          description:
            'Register an email account as entity. password supports plaintext, env("KEY"), or vault("item_id", "field").',
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
              const worldId = resolveEmailWorldId();
              const account = await createEmailAccount(worldId, omitUndefined(input));
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
              const worldId = resolveEmailWorldId();
              const account = await updateEmailAccount(worldId, omitUndefined({ id, ...patch }));
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
              const worldId = resolveEmailWorldId();
              const accounts = await listEmailAccountRows(worldId);
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
              const worldId = resolveEmailWorldId();
              const ok = await deleteEmailAccountRow(worldId, id);
              if (!ok) return toolError(`Email account not found: ${id}`);
              return toolResult({ ok: true, id });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
      ],
      Object.fromEntries(
        ACCOUNT_TOOL_NAMES.map((name) => [name, EMAIL_TOOL_RETURNS[name]]),
      ) as Partial<typeof EMAIL_TOOL_RETURNS>,
    ),
  );
}
