import { describe, expect, it, afterEach } from "bun:test";
import { createTestHookRegistry } from "@freeanima/habitat/kernel/hooks/testing";
import { systemPromptBuild } from "@freeanima/habitat/core/hooks/prompt";
import { foldSystemPromptSections } from "@freeanima/habitat/core/hooks/prompt";

import {
  clearAllProjectAgentContextsForTest,
  setProjectAgentContext,
  type ProjectAgentContextSnapshot,
} from "./index.ts";
import { registerCodingProjectContextPromptHook } from "./project-context-prompt-hooks.ts";

afterEach(() => {
  clearAllProjectAgentContextsForTest();
});

describe("registerCodingProjectContextPromptHook", () => {
  it("injects project context only for coding_agent scenario", async () => {
    const snap: ProjectAgentContextSnapshot = {
      rules: [
        {
          id: "agents-md:AGENTS.md",
          path: "AGENTS.md",
          kind: "always",
          content: "Use bun test",
          source: "agents-md",
        },
      ],
      skills: [
        {
          name: "demo",
          description: "demo skill",
          path: ".agents/skills/demo/SKILL.md",
          source: "agents",
          body: "Do demo",
        },
      ],
      agents: [],
      mcpServers: [],
      agentsMdPath: "AGENTS.md",
      sources: ["agents-md", "agents"],
      discovered_at: new Date().toISOString(),
      workspace_root: "/repo",
    };
    setProjectAgentContext("conv-coding-1", snap);

    const registry = createTestHookRegistry();
    registerCodingProjectContextPromptHook(registry);

    const codingRun = await registry.run(
      systemPromptBuild,
      {
        functionNames: [],
        mode: "work",
        meta: {
          model: "m",
          scenario: "coding_agent",
          conversation_id: "conv-coding-1",
        } as never,
      },
      { llm_kind: "conversation" },
    );
    const codingText = foldSystemPromptSections(codingRun.chain);
    expect(codingText).toContain("Use bun test");
    expect(codingText).toContain("demo");

    const chatRun = await registry.run(
      systemPromptBuild,
      {
        functionNames: [],
        mode: "digital_human",
        meta: {
          model: "m",
          scenario: "digital_human",
          conversation_id: "conv-coding-1",
        } as never,
      },
      { llm_kind: "conversation" },
    );
    const chatText = foldSystemPromptSections(chatRun.chain);
    expect(chatText).not.toContain("Use bun test");
  });
});
