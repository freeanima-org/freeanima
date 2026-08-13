import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";

import {
  createEmailAccount,
  deleteEmailAccountRow,
  listEmailAccountRows,
  updateEmailAccount,
} from "./account-store.ts";
import {
  accountCreateSchema,
  accountPatchSchema,
  accountPayload,
  errMsg,
  resolveEmailToolTagIds,
  type EmailToolIo,
  parseMessageId,
} from "./email-tool-helpers.ts";
import { EMAIL_TOOL_RETURNS } from "./return-schemas.ts";
import { resolveEmailToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";

const ACCOUNT_TOOL_NAMES = [
  "email_register_account",
  "email_edit_account",
  "email_list_accounts",
  "email_delete_account",
] as const;

export function registerEmailAccountTools(toolSets: ToolSetRegistry, io: EmailToolIo): void {
  toolSets.registerToolSet(
    "email-account",
    "Email account setup (load toolset `email` for sync and mailbox ops); world_id optional.",
    attachToolReturns(
      [
        {
          name: "email_register_account",
          description:
            'Register an email account as entity. password supports plaintext, env("KEY"), or vault("item_id", "field"). Pass provider (aliyun|gmail|qq) to fill default IMAP/SMTP, or provide smtp_*/imap_* explicitly.',
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              password: { type: "string" },
              address: { type: "string" },
              display_name: { type: "string" },
              provider: {
                type: "string",
                enum: ["aliyun", "gmail", "qq", "custom"],
                description: "Named provider preset for IMAP/SMTP defaults (explicit only).",
              },
              smtp_host: { type: "string" },
              smtp_port: { type: "number" },
              imap_host: { type: "string" },
              imap_port: { type: "number" },
              default_sender: { type: "boolean" },
              enabled: { type: "boolean" },
              desc: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              tag_ids: { type: "array", items: { type: "integer" } },
            },
            required: ["subject_kind", "password", "address"],
          },
          handler: async (args) => {
            try {
              const worldId = await resolveEmailToolWorld({ args, access: "write" });
              if (typeof worldId === "string") return worldId;

              const input = accountCreateSchema.parse(args);
              const { tags, tag_ids: rawTagIds, ...rest } = input;
              const tag_ids = await resolveEmailToolTagIds(
                worldId,
                omitUndefined({ tags, tag_ids: rawTagIds }),
              );
              await io.assertPasswordResolvable({ password: input.password });
              const account = await createEmailAccount(
                worldId,
                omitUndefined({ ...rest, tag_ids }),
              );
              return toolResult({ ok: true, account: accountPayload(account) });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_edit_account",
          description:
            "Edit a registered email account entity. Pass provider (aliyun|gmail|qq) to fill missing IMAP/SMTP defaults.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "number" },
              password: { type: "string" },
              address: { type: "string" },
              display_name: { type: "string" },
              provider: {
                type: "string",
                enum: ["aliyun", "gmail", "qq", "custom"],
                description: "Named provider preset for IMAP/SMTP defaults (explicit only).",
              },
              smtp_host: { type: "string" },
              smtp_port: { type: "number" },
              imap_host: { type: "string" },
              imap_port: { type: "number" },
              default_sender: { type: "boolean" },
              enabled: { type: "boolean" },
              desc: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              tag_ids: { type: "array", items: { type: "integer" } },
            },
            required: ["subject_kind", "id"],
          },
          handler: async (args) => {
            const id = parseMessageId(args.id);
            if (id == null) return toolError("id is required");
            try {
              const worldId = await resolveEmailToolWorld({
                args,
                entityId: id,
                access: "write",
              });
              if (typeof worldId === "string") return worldId;

              const patch = accountPatchSchema.parse(args);
              const { tags, tag_ids: rawTagIds, ...rest } = patch;
              const tag_ids = await resolveEmailToolTagIds(
                worldId,
                omitUndefined({ tags, tag_ids: rawTagIds }),
              );
              if (patch.password) await io.assertPasswordResolvable({ password: patch.password });
              const account = await updateEmailAccount(
                worldId,
                omitUndefined({ id, ...rest, tag_ids }),
              );
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
          parameters: {
            type: "object",
            properties: { ...WORLD_ID_OPTIONAL },
            required: ["subject_kind"],
          },
          handler: async (args) => {
            try {
              const worldId = await resolveEmailToolWorld({ args });
              if (typeof worldId === "string") return worldId;

              const accounts = await listEmailAccountRows(worldId);
              return toolResult({ accounts: accounts.map(accountPayload) });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
        {
          name: "email_delete_account",
          description:
            "Delete an email account and its locally synced messages/threads. Does not delete mail on the remote server.",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              id: { type: "number" },
            },
            required: ["subject_kind", "id"],
          },
          handler: async (args) => {
            const id = parseMessageId(args.id);
            if (id == null) return toolError("id is required");
            try {
              const worldId = await resolveEmailToolWorld({
                args,
                entityId: id,
                access: "write",
              });
              if (typeof worldId === "string") return worldId;

              const ok = await deleteEmailAccountRow(worldId, id);
              if (!ok) return toolError(`Email account not found: ${id}`);
              return toolResult({ ok: true, id });
            } catch (err) {
              return toolError(errMsg(err));
            }
          },
        },
      ],
      Object.fromEntries(ACCOUNT_TOOL_NAMES.map((name) => [name, EMAIL_TOOL_RETURNS[name]])),
    ),
    { visibility: "searchable" },
  );
}
