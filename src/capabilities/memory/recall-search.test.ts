import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import type {
  AutobiographicalFtsHit,
  LimbicFtsHit,
  MessageFtsHit,
  SemanticFtsHit,
} from "@freeanima/core/repos";

const searchSemanticMemoryFtsMock = mock(async (..._args: unknown[]) => [] as SemanticFtsHit[]);
const searchMessagesFtsMock = mock(async (..._args: unknown[]) => [] as MessageFtsHit[]);
const searchLimbicMemoryFtsMock = mock(async (..._args: unknown[]) => [] as LimbicFtsHit[]);
const searchAutobiographicalMemoryFtsMock = mock(
  async (..._args: unknown[]) => [] as AutobiographicalFtsHit[],
);

mock.module("@freeanima/core/db/pg/semantic-memory", () => ({
  searchSemanticMemoryFts: searchSemanticMemoryFtsMock,
}));
mock.module("@freeanima/core/db/pg/conversation", () => ({
  searchMessagesFts: searchMessagesFtsMock,
}));
mock.module("@freeanima/core/db/pg/limbic-memory", () => ({
  searchLimbicMemoryFts: searchLimbicMemoryFtsMock,
}));
mock.module("@freeanima/core/db/pg/autobiographical-memory", () => ({
  searchAutobiographicalMemoryFts: searchAutobiographicalMemoryFtsMock,
}));

import { memoryRecallSearch } from "./recall-search.ts";

describe("memoryRecallSearch", () => {
  beforeEach(() => {
    searchSemanticMemoryFtsMock.mockClear();
    searchMessagesFtsMock.mockClear();
    searchLimbicMemoryFtsMock.mockClear();
    searchAutobiographicalMemoryFtsMock.mockClear();
  });

  afterEach(() => {
    searchSemanticMemoryFtsMock.mockClear();
    searchMessagesFtsMock.mockClear();
    searchLimbicMemoryFtsMock.mockClear();
    searchAutobiographicalMemoryFtsMock.mockClear();
  });

  it("merges four sources and returns unified results with memory_type", async () => {
    const now = new Date("2026-05-26T12:00:00+08:00");
    searchSemanticMemoryFtsMock.mockImplementation((async () => [
      {
        id: "f-000001-abcd",
        content: "compression semantic probe",
        type: "world",
        pinned: false,
        rank: 0.8,
        source_conversations: ["sid"],
        observed_at: now,
        occurred_at: null,
        status: "active",
      },
    ]) as never);
    searchMessagesFtsMock.mockImplementation((async () => [
      {
        message_id: "msg-001",
        conversation_id: "sid",
        role: "user",
        content:
          "prefix padding text before the important compression conversation message appears here with much more suffix padding text",
        timestamp: now.toISOString(),
        rank: 0.2,
      },
    ]) as never);
    searchLimbicMemoryFtsMock.mockImplementation((async () => [
      {
        id: "lm-1",
        conversation_id: "sid",
        kind: "spike",
        content: "compression limbic feeling",
        intensity: 0.8,
        valence: -0.2,
        arousal: 0.6,
        rank: 0.5,
        semantic_memory_ids: [],
        created_at: now,
      },
    ]) as never);
    searchAutobiographicalMemoryFtsMock.mockImplementation((async () => [
      {
        id: "ab-1",
        title: "compression milestone",
        content: "long autobiographical compression narrative",
        significance: "normal",
        rank: 0.4,
        source_facts: [],
        source_conversations: ["sid"],
        status: "active",
        created_at: now,
        updated_at: now,
      },
    ]) as never);

    const out = await memoryRecallSearch("compression", { limit: 10 });
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.length).toBeLessThanOrEqual(10);
    const types = new Set(out.results.map((r) => r.memory_type));
    expect(types.has("semantic")).toBe(true);
    expect(types.has("conversation")).toBe(true);
    expect(types.has("limbic")).toBe(true);
    expect(types.has("autobiographical")).toBe(true);

    const sessionHit = out.results.find((r) => r.memory_type === "conversation");
    expect(sessionHit).toBeDefined();
    if (sessionHit?.memory_type === "conversation") {
      expect(sessionHit.snippet).toContain("compression");
      expect(sessionHit.snippet.length).toBeLessThan(
        "prefix padding text before the important compression conversation message appears here with much more suffix padding text"
          .length,
      );
    }
  });

  it("respects limit cap", async () => {
    const now = new Date("2026-05-26T12:00:00+08:00");
    searchSemanticMemoryFtsMock.mockImplementation((async () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: `f-${String(i).padStart(6, "0")}-abcd`,
        content: `compression item ${i}`,
        type: "world",
        pinned: false,
        rank: 1 / (i + 1),
        source_conversations: [],
        observed_at: now,
        occurred_at: null,
        status: "active",
      }))) as never);

    const out = await memoryRecallSearch("compression", { limit: 5 });
    expect(out.limit).toBe(5);
    expect(out.results.length).toBe(5);
  });
});
