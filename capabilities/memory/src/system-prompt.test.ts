import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import type { SemanticMemoryStorePort } from "@freeanima/core/repos";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts,
  RESIDENT_MEMORY_SYSTEM_FRAME,
} from "./system-prompt.ts";
import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "./semantic-port.ts";
import { MEMORY_REFERENCE_CITATION_RULE } from "./memory-reference.ts";
import { buildMemorySystemPromptSections } from "./system-prompt-sections.ts";

function createMockSemanticStore(resident: Array<{ content: string; pinned?: boolean }> = []) {
  return {
    async listResident() {
      return resident.map((row, i) => ({
        id: `f-00000${i}-abcd`,
        content: row.content,
        type: "fact",
        pinned: row.pinned ?? false,
        reference_count: 0,
        source_sessions: [],
        observed_at: null,
        occurred_at: null,
        status: "active",
        created: "",
        updated: "",
      }));
    },
  } as unknown as SemanticMemoryStorePort;
}

describe("system-prompt", () => {
  beforeEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("composeSystemPrompt order is self → resident → agents", () => {
    const composed = composeSystemPrompt({
      self: "SELF_MARKER",
      resident: "RESIDENT_MARKER",
      agents: "AGENTS_MARKER",
      toolsets: "",
    });
    const selfIdx = composed.indexOf("SELF_MARKER");
    const residentIdx = composed.indexOf("RESIDENT_MARKER");
    const agentsIdx = composed.indexOf("AGENTS_MARKER");
    expect(selfIdx).toBeLessThan(residentIdx);
    expect(residentIdx).toBeLessThan(agentsIdx);
  });

  it("resident memory segment includes second-person frame and code fence", async () => {
    registerSemanticMemoryStore(
      createMockSemanticStore([{ content: "I like testing", pinned: true }]),
    );
    const parts = await decomposeSystemPromptParts("self layer content");
    expect(parts.resident).toContain(RESIDENT_MEMORY_SYSTEM_FRAME);
    expect(parts.resident).toContain("## Resident memory");
    expect(parts.resident).toContain("```md");
    expect(parts.resident).toContain("- 📌 [[f-000000-abcd]] I like testing");
    expect(parts.resident).not.toContain(MEMORY_REFERENCE_CITATION_RULE);
  });

  it("memory-citation section is always present even without resident memory", async () => {
    registerSemanticMemoryStore(createMockSemanticStore());
    const sections = await buildMemorySystemPromptSections("self layer content");
    const citation = sections.find((s) => s.id === "memory-citation");
    expect(citation).toBeDefined();
    expect(citation!.content).toBe(MEMORY_REFERENCE_CITATION_RULE);
    expect(citation!.order).toBe(25);
  });

  it("project context segment includes code fence without second-person frame", async () => {
    const dir = createTempDir("anima-agents-");
    try {
      writeFileSync(
        join(dir, "AGENTS.md"),
        "# Project conventions\nUse type annotations.",
        "utf-8",
      );
      registerSemanticMemoryStore(createMockSemanticStore());

      const parts = await decomposeSystemPromptParts("self layer", dir);
      expect(parts.agents).toContain("## Project context");
      expect(parts.agents).toContain("```md");
      expect(parts.agents).toContain("Use type annotations");
      expect(parts.agents).not.toContain(RESIDENT_MEMORY_SYSTEM_FRAME);
    } finally {
      removeTempDir(dir);
    }
  });

  it("omits empty resident memory and missing AGENTS.md segments", async () => {
    registerSemanticMemoryStore(createMockSemanticStore());
    const parts = await decomposeSystemPromptParts("self layer", null);
    expect(parts.resident).toBe("");
    expect(parts.agents).toBe("");
  });
});
