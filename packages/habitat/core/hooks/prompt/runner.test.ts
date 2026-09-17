import { afterAll, expect, it } from "bun:test";

import { resetRootContextForTest, setRootContext } from "@freeanima/kernel";

import { createHookContext, onSystemPromptBuild } from "../cordis/index.ts";
import { buildSystemPrompt } from "./runner.ts";
import { SystemPromptService } from "./service.ts";

let activeCtx = createHookContext();
setRootContext(activeCtx);

afterAll(() => {
  resetRootContextForTest();
});

const tick = async (): Promise<void> => {
  await new Promise<void>((r) => {
    setTimeout(r, 0);
  });
};

it("builds via the Cordis SystemPromptService and fold", async () => {
  activeCtx = createHookContext();
  setRootContext(activeCtx);
  onSystemPromptBuild(activeCtx, () => ({
    sections: [{ id: "a", content: "A", order: 0 }],
  }));
  await activeCtx.plugin(SystemPromptService, {});
  await tick();
  await expect(buildSystemPrompt(["tool_a"])).resolves.toBe("A");
});

it("throws when the service is not mounted", async () => {
  activeCtx = createHookContext();
  setRootContext(activeCtx);
  await expect(buildSystemPrompt(["tool_a"])).rejects.toThrow("SystemPromptService not mounted");
});
