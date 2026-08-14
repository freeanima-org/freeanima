import { describe, expect, it, mock } from "bun:test";

mock.module("@freeanima/habitat/core/db/pg/semantic-memory", () => ({
  listResidentSemanticMemory: mock(async () => []),
}));

import { SELF_LAYER_SYSTEM_FRAME } from "@freeanima/habitat/capabilities/self";
import { buildAutoLlmSystemPrompt } from "./build-auto-llm-prompt.ts";
import { MEMORY_REFERENCE_CITATION_RULE } from "@freeanima/habitat/capabilities/memory/memory-reference";

describe("buildAutoLlmSystemPrompt", () => {
  it("work mode: citation present, no digital-human self frame", async () => {
    const prompt = await buildAutoLlmSystemPrompt();
    expect(prompt).toContain(MEMORY_REFERENCE_CITATION_RULE);
    expect(prompt).not.toContain(SELF_LAYER_SYSTEM_FRAME);
    expect(prompt).not.toContain("digital human");
  });
});
