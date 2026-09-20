import { afterEach, expect, it } from "bun:test";

import { createHookContext, onSystemPromptBuild } from "../cordis/index.ts";
import { buildSystemPrompt } from "./runner.ts";
import { resetSystemPromptServiceForTest, SystemPromptService } from "./service.ts";

afterEach(() => {
  resetSystemPromptServiceForTest();
});

const tick = async (): Promise<void> => {
  await new Promise<void>((r) => {
    setTimeout(r, 0);
  });
};

it("builds via the Cordis SystemPromptService and fold", async () => {
  const ctx = createHookContext();
  onSystemPromptBuild(ctx, () => ({
    sections: [{ id: "a", content: "A", order: 0 }],
  }));
  await ctx.plugin(SystemPromptService, {});
  await tick();
  await expect(buildSystemPrompt(["tool_a"])).resolves.toBe("A");
});

it("throws when the service is not mounted", async () => {
  await expect(buildSystemPrompt(["tool_a"])).rejects.toThrow("SystemPromptService not mounted");
});
