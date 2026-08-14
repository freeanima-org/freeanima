import { Config } from "@freeanima/host/core/config";
import { SkillRegistry } from "@freeanima/host/core/skill";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";

import { registerServiceTools, resetRegisterServiceToolsForTest } from "./register.ts";

function testConfig() {
  const parsed = runtimeConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot(parsed.data);
}

describe("registerServiceTools", () => {
  let toolSets: ToolSetRegistry;
  let skills: SkillRegistry;
  let config: ReturnType<typeof testConfig>;

  beforeEach(() => {
    resetRegisterServiceToolsForTest();
    toolSets = new ToolSetRegistry();
    skills = new SkillRegistry();
    config = testConfig();
  });

  afterEach(() => {
    resetRegisterServiceToolsForTest();
  });

  it("registers core tool names", () => {
    registerServiceTools({ toolSets, skills, config });
    const names = new Set(toolSets.listTools().map((t) => t.name));
    expect(names.has("file_read")).toBe(true);
    expect(names.has("toolset_search")).toBe(true);
    expect(names.has("toolset_load")).toBe(true);
    expect(names.has("toolset_unload")).toBe(true);
    expect(names.has("todo")).toBe(false);
    expect(names.has("cronjob_list")).toBe(true);
    expect(names.has("cronjob_create")).toBe(true);
    expect(names.has("cronjob_remove")).toBe(true);
    expect(names.has("cron_job")).toBe(false);
    expect(toolSets.getToolSet("cronjob") != null).toBe(true);
    expect(toolSets.getToolSet("cron") == null).toBe(true);
    expect(names.has("task_create")).toBe(true);
    expect(names.has("clarify")).toBe(true);
    expect(names.has("email_list_accounts")).toBe(true);
    expect(names.has("email_send")).toBe(true);
    expect(names.has("freeanima_docs_list")).toBe(true);
    expect(names.has("freeanima_docs_get")).toBe(true);
    expect(names.has("freeanima_docs_search")).toBe(true);
    expect(toolSets.getToolSet("freeanima_docs") != null).toBe(true);
  });

  it("is idempotent", () => {
    registerServiceTools({ toolSets, skills, config });
    const before = toolSets.listTools().length;
    registerServiceTools({ toolSets, skills, config });
    expect(toolSets.listTools().length).toBe(before);
  });
});
