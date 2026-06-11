import { Config } from "@freeanima/engine-config";
import { SkillRegistry } from "@freeanima/engine-skill";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";

import { registerServiceTools, resetRegisterServiceToolsForTest } from "./register.ts";

function testConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
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
    registerServiceTools({ toolSets, skills, config });
    const before = toolSets.listTools().length;
    registerServiceTools({ toolSets, skills, config });
    expect(toolSets.listTools().length).toBe(before);
  });
});
