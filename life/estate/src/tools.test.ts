import { describe, expect, it } from "bun:test";
import { listTools } from "@freeanima/engine-tool";

import { registerEmailTools } from "./email/tools.ts";

const EMAIL_TOOL_NAMES = [
  "register_email_account",
  "edit_email_account",
  "list_email_accounts",
  "delete_email_account",
  "send_email",
  "fetch_emails",
  "list_emails",
  "read_email",
  "mark_email_read",
  "delete_email",
] as const;

describe("registerEmailTools", () => {
  it("注册 10 个邮件工具", () => {
    registerEmailTools();
    const names = new Set(listTools().map((t) => t.name));
    for (const name of EMAIL_TOOL_NAMES) {
      expect(names.has(name)).toBe(true);
    }
  });
});
