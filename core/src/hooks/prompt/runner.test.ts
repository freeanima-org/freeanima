import { afterEach, describe, expect, it } from "bun:test";

import {
  buildSystemPrompt,
  registerSystemPromptHookRunner,
  resetSystemPromptHookRunnerForTest,
} from "./runner.ts";

describe("system prompt runner", () => {
  afterEach(() => {
    resetSystemPromptHookRunnerForTest();
  });

  it("throws when runner not registered", async () => {
    await expect(buildSystemPrompt(["tool_a"])).rejects.toThrow(
      "SystemPromptHookRunner not registered",
    );
  });

  it("delegates to registered runner", async () => {
    registerSystemPromptHookRunner(async ({ functionNames, cwd }) => {
      return `tools:${functionNames.join(",")};cwd:${cwd ?? "none"}`;
    });
    await expect(buildSystemPrompt(["a", "b"], "/tmp")).resolves.toBe("tools:a,b;cwd:/tmp");
  });
});
