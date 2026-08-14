import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { registerCronjobTool } from "./cronjob-tool.ts";
import { CRON_TOOL_RETURNS } from "./return-schemas.ts";

describe("cronjob toolset", () => {
  it("registers cronjob_* tools under toolset cronjob", () => {
    const toolSets = new ToolSetRegistry();
    registerCronjobTool(toolSets);

    expect(toolSets.getToolSet("cronjob")).toBeTruthy();
    expect(toolSets.getToolSet("cron")).toBeFalsy();

    const names = new Set(toolSets.listTools().map((t) => t.name));
    for (const name of [
      "cronjob_list",
      "cronjob_get",
      "cronjob_create",
      "cronjob_remove",
      "cronjob_pause",
      "cronjob_resume",
      "cronjob_run",
    ]) {
      expect(names.has(name)).toBe(true);
      expect(CRON_TOOL_RETURNS[name]).toBeDefined();
    }
    expect(names.has("cron_job")).toBe(false);
  });
});
