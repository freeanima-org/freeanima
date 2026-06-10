import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/engine-tool";

import { registerEmailTools } from "./email/tools.ts";

const EMAIL_TOOL_NAMES = [
  "email_register_account",
  "email_edit_account",
  "email_list_accounts",
  "email_delete_account",
  "email_send",
  "email_fetch",
  "email_list",
  "email_read",
  "email_mark_read",
  "email_delete",
] as const;

describe("registerEmailTools", () => {
  it("注册 10 个邮件工具", () => {
    const tools = new ToolSetRegistry();
    registerEmailTools(tools);
    const names = new Set(tools.listTools().map((t) => t.name));
    for (const name of EMAIL_TOOL_NAMES) {
      expect(names.has(name)).toBe(true);
    }
  });
});
