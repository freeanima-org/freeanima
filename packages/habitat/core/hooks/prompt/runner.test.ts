import { afterAll, expect, it, mock } from "bun:test";

import { createHookContext, onSystemPromptBuild } from "../cordis/index.ts";
import { SystemPromptService } from "./service.ts";

let activeCtx = createHookContext();

const processOriginal = await import("@freeanima/habitat/platform/service/process-context.ts");
mock.module("@freeanima/habitat/platform/service/process-context.ts", () => ({
  ...processOriginal,
  getProcessContext: () => activeCtx,
}));

afterAll(() => {
  mock.module("@freeanima/habitat/platform/service/process-context.ts", () => processOriginal);
});

const { buildSystemPrompt } = await import("./runner.ts");

const tick = async (): Promise<void> => {
  await new Promise<void>((r) => {
    setTimeout(r, 0);
  });
};

it("builds via the Cordis SystemPromptService and fold", async () => {
  activeCtx = createHookContext();
  onSystemPromptBuild(activeCtx, () => ({
    sections: [{ id: "a", content: "A", order: 0 }],
  }));
  await activeCtx.plugin(SystemPromptService, {});
  await tick();
  await expect(buildSystemPrompt(["tool_a"])).resolves.toBe("A");
});

it("throws when the service is not mounted", async () => {
  activeCtx = createHookContext();
  await expect(buildSystemPrompt(["tool_a"])).rejects.toThrow("SystemPromptService not mounted");
});
