import { Config } from "@freeanima/habitat/core/config";
import { SkillRegistry } from "@freeanima/habitat/core/skill";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { parseYaml } from "@freeanima/habitat/platform/config";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/habitat/platform/config/test-helpers/minimal-llm-config";

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
    expect(names.has("tasklist_list")).toBe(true);
    expect(names.has("project_list")).toBe(true);
    expect(names.has("calendar_list")).toBe(true);
    expect(toolSets.getToolSet("agenda") != null).toBe(true);
    expect(toolSets.getToolSet("task") == null).toBe(true);
    expect(toolSets.getToolSet("tasklist") == null).toBe(true);
    expect(toolSets.getToolSet("project") == null).toBe(true);
    expect(toolSets.getToolSet("calendar") == null).toBe(true);
    expect(names.has("clarify")).toBe(true);
    expect(names.has("email_list_accounts")).toBe(true);
    expect(names.has("email_send")).toBe(true);
    expect(toolSets.getToolSet("email") != null).toBe(true);
    expect(toolSets.getToolSet("email-account") == null).toBe(true);
    expect(names.has("note_create")).toBe(true);
    expect(names.has("diary_append")).toBe(true);
    expect(names.has("content_block_list")).toBe(true);
    expect(toolSets.getToolSet("content") != null).toBe(true);
    expect(toolSets.getToolSet("note") == null).toBe(true);
    expect(names.has("memory_remember")).toBe(true);
    expect(names.has("memory_semantic_search")).toBe(true);
    expect(toolSets.getToolSet("memory") != null).toBe(true);
    expect(toolSets.getToolSet("memory_semantic") == null).toBe(true);
    expect(toolSets.getToolSet("memory_service") != null).toBe(true);
    expect(toolSets.getToolSet("memory_service")!.visibility).toBe("searchable");
    expect(toolSets.getToolSet("self") != null).toBe(true);
    expect(toolSets.getToolSet("self")!.visibility).toBe("searchable");
    expect(names.has("terminal_run")).toBe(true);
    expect(names.has("code_execute")).toBe(true);
    expect(toolSets.getToolSet("shell") != null).toBe(true);
    expect(toolSets.getToolSet("terminal") == null).toBe(true);
    expect(toolSets.getToolSet("code") == null).toBe(true);
    expect(names.has("entity_get")).toBe(true);
    expect(names.has("entity_attach_component")).toBe(true);
    expect(names.has("entity_detach_component")).toBe(true);
    expect(names.has("entity_promote_component")).toBe(true);
    expect(names.has("tag_list")).toBe(true);
    expect(toolSets.getToolSet("entity") != null).toBe(true);
    expect(toolSets.getToolSet("tag") == null).toBe(true);
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
