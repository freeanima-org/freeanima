import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SemanticMemoryStorePort } from "@freeanima/engine-repos";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts,
  RESIDENT_MEMORY_SYSTEM_FRAME,
} from "./system-prompt.ts";
import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "./semantic-port.ts";
import { MEMORY_REFERENCE_CITATION_RULE } from "./memory-reference.ts";

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
    expect(parts.resident).toContain("- 📌 [memory #f-000000-abcd] I like testing");
    expect(parts.resident).toContain(MEMORY_REFERENCE_CITATION_RULE);
  });

  it("project context segment includes code fence without second-person frame", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-agents-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Project conventions\nUse type annotations.", "utf-8");
    registerSemanticMemoryStore(createMockSemanticStore());

    const parts = await decomposeSystemPromptParts("self layer", dir);
    expect(parts.agents).toContain("## Project context");
    expect(parts.agents).toContain("```md");
    expect(parts.agents).toContain("Use type annotations");
    expect(parts.agents).not.toContain(RESIDENT_MEMORY_SYSTEM_FRAME);
  });

  it("omits empty resident memory and missing AGENTS.md segments", async () => {
    registerSemanticMemoryStore(createMockSemanticStore());
    const parts = await decomposeSystemPromptParts("self layer", null);
    expect(parts.resident).toBe("");
    expect(parts.agents).toBe("");
  });
});
