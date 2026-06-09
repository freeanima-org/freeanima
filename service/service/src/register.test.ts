import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolRegistry } from "@freeanima/engine-tool";
import { describe, it, expect, afterEach } from "bun:test";

import { registerServiceTools, resetRegisterServiceToolsForTest } from "./register.ts";

const tools = new ToolRegistry();
const skills = new SkillRegistry();

describe("registerServiceTools", () => {
  afterEach(() => {
    resetRegisterServiceToolsForTest();
  });

  it("registers core tool names", () => {
    registerServiceTools({ tools, skills });
    const names = new Set(tools.list().map((t) => t.name));
    expect(names.has("read_file")).toBe(true);
    expect(names.has("todo")).toBe(true);
    expect(names.has("cronjob")).toBe(true);
    expect(names.has("create_task")).toBe(true);
    expect(names.has("clarify")).toBe(true);
    expect(names.has("list_email_accounts")).toBe(true);
    expect(names.has("send_email")).toBe(true);
  });

  it("is idempotent", () => {
    const before = tools.list().length;
    registerServiceTools({ tools, skills });
    registerServiceTools({ tools, skills });
    expect(tools.list().length).toBe(before);
  });
});
