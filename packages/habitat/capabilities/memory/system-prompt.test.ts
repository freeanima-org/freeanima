import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts,
  RESIDENT_MEMORY_SYSTEM_FRAME,
} from "./system-prompt.ts";
import { MEMORY_RECALL_STRATEGY_RULE, MEMORY_REFERENCE_CITATION_RULE } from "./memory-reference.ts";
import { buildMemorySystemPromptSections } from "./system-prompt-sections.ts";

const listResidentSemanticMemoryMock = mock(
  async (..._args: unknown[]) => [] as SemanticMemoryRow[],
);

mock.module("@freeanima/habitat/core/db/pg/semantic-memory", () => ({
  listResidentSemanticMemory: listResidentSemanticMemoryMock,
}));

describe("system-prompt", () => {
  beforeEach(() => {
    listResidentSemanticMemoryMock.mockClear();
    listResidentSemanticMemoryMock.mockImplementation(async () => []);
  });

  afterEach(() => {
    listResidentSemanticMemoryMock.mockClear();
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

  it("resident memory segment includes second-person frame and XML shell", async () => {
    listResidentSemanticMemoryMock.mockImplementation((async () => [
      {
        id: 42,
        content: "I like testing",
        type: "fact",
        pinned: true,
        reference_count: 0,
        source_conversations: [],
        observed_at: null,
        occurred_at: null,
        status: "active",
        content_embedding: null,
        content_fts: null,
        fts_segmented: null,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]) as never);
    const parts = await decomposeSystemPromptParts("self layer content", null, {
      world_id: 1,
    });
    expect(parts.resident).toContain(RESIDENT_MEMORY_SYSTEM_FRAME);
    expect(parts.resident).toContain("<resident_memory>");
    expect(parts.resident).toContain("</resident_memory>");
    expect(parts.resident).not.toContain("```md");
    expect(parts.resident).toContain('<memory id="42" pinned="true">I like testing</memory>');
    expect(parts.resident).not.toContain("[[anima:42]]");
    expect(parts.resident).not.toContain(MEMORY_REFERENCE_CITATION_RULE);
  });

  it("memory-citation section is always present even without resident memory", async () => {
    const sections = await buildMemorySystemPromptSections("self layer content");
    const citation = sections.find((s) => s.id === "memory-citation");
    expect(citation).toBeDefined();
    expect(citation!.content).toBe(MEMORY_REFERENCE_CITATION_RULE);
    expect(citation!.xmlTag).toBe("memory_citation");
    expect(citation!.order).toBe(25);
  });

  it("memory-recall strategy section is always present", async () => {
    const sections = await buildMemorySystemPromptSections("self layer content");
    const recall = sections.find((s) => s.id === "memory-recall");
    expect(recall).toBeDefined();
    expect(recall!.content).toBe(MEMORY_RECALL_STRATEGY_RULE);
    expect(recall!.xmlTag).toBe("memory_recall");
    expect(recall!.order).toBe(26);
  });

  it("self section uses xmlTag + frame with nested inner body", async () => {
    const sections = await buildMemorySystemPromptSections("<self_model>\ninner\n</self_model>");
    const self = sections.find((s) => s.id === "self");
    expect(self).toBeDefined();
    expect(self!.content).toContain("<self_model>");
    expect(self!.xmlTag).toBe("self_layer");
    expect(self!.xmlFrame).toBeTruthy();
  });

  it("work mode omits self and resident; project AGENTS.md no longer loaded from cwd", async () => {
    listResidentSemanticMemoryMock.mockImplementation((async () => [
      {
        id: 1,
        content: "pinned",
        type: "fact",
        pinned: true,
        reference_count: 0,
        source_conversations: [],
        observed_at: null,
        occurred_at: null,
        status: "active",
        content_embedding: null,
        content_fts: null,
        fts_segmented: null,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]) as never);
    const dir = createTempDir("anima-agents-work-");
    try {
      writeFileSync(join(dir, "AGENTS.md"), "# Work agents", "utf-8");
      const sections = await buildMemorySystemPromptSections("SELF_SHOULD_HIDE", dir, "work");
      expect(sections.find((s) => s.id === "self")).toBeUndefined();
      expect(sections.find((s) => s.id === "resident")).toBeUndefined();
      expect(sections.find((s) => s.id === "memory-citation")).toBeDefined();
      expect(sections.find((s) => s.id === "memory-recall")).toBeDefined();
      expect(sections.find((s) => s.id === "agents")).toBeUndefined();
      expect(listResidentSemanticMemoryMock).not.toHaveBeenCalled();
    } finally {
      removeTempDir(dir);
    }
  });

  it("does not load AGENTS.md from arbitrary cwd (coding-only via Outpost sync)", async () => {
    const dir = createTempDir("anima-agents-");
    try {
      writeFileSync(
        join(dir, "AGENTS.md"),
        "# Project conventions\nUse type annotations.",
        "utf-8",
      );

      const parts = await decomposeSystemPromptParts("self layer", dir);
      expect(parts.agents).toBe("");
    } finally {
      removeTempDir(dir);
    }
  });

  it("omits empty resident memory and missing AGENTS.md segments", async () => {
    const parts = await decomposeSystemPromptParts("self layer", null);
    expect(parts.resident).toBe("");
    expect(parts.agents).toBe("");
  });
});
