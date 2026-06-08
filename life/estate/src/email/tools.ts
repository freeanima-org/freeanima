import { registerTool, toolError, toolResult } from "@freeanima/engine-tool";

import {
  deleteEmailAccount,
  editEmailAccount,
  listEmailAccounts,
  registerEmailAccount,
} from "./accounts.ts";
import { markAsRead, deleteEmail as deleteImapEmail } from "./actions.ts";
import { fetchEmails, listEmails, readEmail } from "./receive.ts";
import { sendEmail } from "./send.ts";
import { emailAccountInputSchema, emailAccountPatchSchema, emailFilterSchema } from "./types.ts";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerEmailTools(): void {
  registerTool({
    name: "register_email_account",
    description:
      '注册邮件账户到 config.yaml。password 支持明文、env("KEY") 或 credential("path", "field")。',
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "账户 ID（config 内唯一标识）" },
        password: {
          type: "string",
          description: '密码引用，如 credential("email/feng-fengtrace", "password")',
        },
        address: { type: "string", description: "邮箱地址" },
        display_name: { type: "string", description: "发件显示名" },
        smtp_host: { type: "string" },
        smtp_port: { type: "number" },
        imap_host: { type: "string" },
        imap_port: { type: "number" },
        default_sender: { type: "boolean", description: "是否为默认发件账户" },
        enabled: { type: "boolean" },
        desc: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["id", "password", "address", "smtp_host", "smtp_port", "imap_host", "imap_port"],
    },
    handler: async (args) => {
      try {
        const input = emailAccountInputSchema.parse(args);
        const account = await registerEmailAccount(input);
        return toolResult({ ok: true, account });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "edit_email_account",
    description: "编辑已注册邮件账户（password 可改为新的 env/credential 引用）。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        password: { type: "string", description: "明文 / env() / credential() 引用" },
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
        const account = editEmailAccount(id, emailAccountPatchSchema.parse(patch));
        return toolResult({ ok: true, account });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "list_email_accounts",
    description: "列出 config.yaml 中的邮件账户（含 pass 路径，不含密码）。",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      try {
        return toolResult({ accounts: listEmailAccounts() });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "delete_email_account",
    description: "从 config.yaml 删除邮件账户（不删除 pass 凭证）。",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: async (args) => {
      const id = String(args.id ?? "").trim();
      if (!id) return toolError("id is required");
      try {
        deleteEmailAccount(id);
        return toolResult({ ok: true, id });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "send_email",
    description: "通过已配置账户发送邮件。",
    parameters: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "发件账户 ID，省略则用默认账户" },
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
        const result = await sendEmail({
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
  });

  registerTool({
    name: "fetch_emails",
    description: "从 IMAP 拉取最近邮件摘要。",
    parameters: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "账户 ID，省略则查询全部启用账户" },
        limit: { type: "number", description: "条数，默认 20" },
      },
    },
    handler: async (args) => {
      try {
        const messages = await fetchEmails(
          args.account_id != null ? String(args.account_id) : undefined,
          args.limit != null ? Number(args.limit) : undefined,
        );
        return toolResult({ messages, count: messages.length });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "list_emails",
    description: "按条件列出 IMAP 邮件摘要。",
    parameters: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        unread: { type: "boolean" },
        since: { type: "string", description: "ISO 日期或 YYYY-MM-DD" },
        from: { type: "string" },
        subject: { type: "string", description: "主题包含" },
        limit: { type: "number" },
      },
    },
    handler: async (args) => {
      try {
        const { account_id, ...filterArgs } = args;
        const filter = emailFilterSchema.parse(filterArgs);
        const messages = await listEmails(
          account_id != null ? String(account_id) : undefined,
          filter,
        );
        return toolResult({ messages, count: messages.length });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "read_email",
    description: "读取单封邮件全文。",
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
        const message = await readEmail(accountId, uid);
        return toolResult({ message });
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "mark_email_read",
    description: "将邮件标记为已读。",
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
        const result = await markAsRead(accountId, uid);
        return toolResult(result);
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });

  registerTool({
    name: "delete_email",
    description: "从 IMAP 邮箱删除邮件。",
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
        const result = await deleteImapEmail(accountId, uid);
        return toolResult(result);
      } catch (err) {
        return toolError(errMsg(err));
      }
    },
  });
}
