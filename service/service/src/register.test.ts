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
    expect(names.has("file_read_file")).toBe(true);
    expect(names.has("tools_list")).toBe(true);
    expect(names.has("tools_load")).toBe(true);
    expect(names.has("todo")).toBe(false);
    expect(names.has("cron_job")).toBe(true);
    expect(names.has("tasks_create")).toBe(true);
    expect(names.has("clarify")).toBe(true);
    expect(names.has("email_list_accounts")).toBe(true);
    expect(names.has("email_send")).toBe(true);
  });

  it("is idempotent", () => {
    registerServiceTools({ toolSets, skills });
    const before = toolSets.listTools().length;
    registerServiceTools({ toolSets, skills });
    expect(toolSets.listTools().length).toBe(before);
  });
});
