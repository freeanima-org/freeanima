import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

import { registerServiceTools, resetRegisterServiceToolsForTest } from "./register.ts";

describe("registerServiceTools", () => {
  let toolSets: ToolSetRegistry;
  let skills: SkillRegistry;

  beforeEach(() => {
    resetRegisterServiceToolsForTest();
    toolSets = new ToolSetRegistry();
    skills = new SkillRegistry();
  });

  afterEach(() => {
    resetRegisterServiceToolsForTest();
  });

  it("registers core tool names", () => {
    registerServiceTools({ toolSets, skills });
    const names = new Set(toolSets.listTools().map((t) => t.name));
    expect(names.has("read_file")).toBe(true);
    expect(names.has("tool_search")).toBe(true);
    expect(names.has("tool_load")).toBe(true);
    expect(names.has("todo")).toBe(true);
    expect(names.has("cronjob")).toBe(true);
    expect(names.has("create_task")).toBe(true);
    expect(names.has("clarify")).toBe(true);
    expect(names.has("list_email_accounts")).toBe(true);
    expect(names.has("send_email")).toBe(true);
  });

  it("is idempotent", () => {
    registerServiceTools({ toolSets, skills });
    const before = toolSets.listTools().length;
    registerServiceTools({ toolSets, skills });
    expect(toolSets.listTools().length).toBe(before);
  });
});
