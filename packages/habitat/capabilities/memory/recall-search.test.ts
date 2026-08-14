import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import type { AutobiographicalFtsHit } from "@freeanima/habitat/core/db/pg/autobiographical-memory/types";
import type { LimbicFtsHit } from "@freeanima/habitat/core/db/pg/limbic-memory/types";
import type { MessageFtsHit } from "@freeanima/habitat/core/db/pg/conversation/types";
import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";

const searchSemanticMemoryFtsMock = mock(async (..._args: unknown[]) => [] as SemanticFtsHit[]);
const searchMessagesFtsMock = mock(async (..._args: unknown[]) => [] as MessageFtsHit[]);
const searchLimbicMemoryFtsMock = mock(async (..._args: unknown[]) => [] as LimbicFtsHit[]);
const searchAutobiographicalMemoryFtsMock = mock(
  async (..._args: unknown[]) => [] as AutobiographicalFtsHit[],
);

mock.module("@freeanima/habitat/core/db/pg/semantic-memory", () => ({
  searchSemanticMemoryFts: searchSemanticMemoryFtsMock,
}));
mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  searchMessagesFts: searchMessagesFtsMock,
}));
mock.module("@freeanima/habitat/core/db/pg/limbic-memory", () => ({
  searchLimbicMemoryFts: searchLimbicMemoryFtsMock,
}));
mock.module("@freeanima/habitat/core/db/pg/autobiographical-memory", () => ({
  searchAutobiographicalMemoryFts: searchAutobiographicalMemoryFtsMock,
}));

import { memoryScopedSearch } from "./recall-search.ts";

describe("memoryScopedSearch", () => {
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

  it("concatenates scopes without cross-type RRF and tags memory_type", async () => {
    const now = new Date("2026-05-26T12:00:00+08:00");
    searchSemanticMemoryFtsMock.mockImplementation((async () => [
      {
        id: 1001,
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
    searchMessagesFtsMock.mockImplementation(async () => [
      {
        message_id: "msg-001",
        conversation_id: "sid",
        role: "user",
        content:
          "prefix padding text before the important compression conversation message appears here with much more suffix padding text",
        timestamp: now.toISOString(),
        rank: 0.2,
      },
    ]);
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

    const out = await memoryScopedSearch("compression", { limit: 10 });
    expect(out.results.map((r) => r.memory_type)).toEqual([
      "semantic",
      "conversation",
      "limbic",
      "autobiographical",
    ]);

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

  it("applies per-scope limit", async () => {
    const now = new Date("2026-05-26T12:00:00+08:00");
    searchSemanticMemoryFtsMock.mockImplementation((async () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: 1000 + i,
        content: `compression item ${i}`,
        type: "world",
        pinned: false,
        rank: 1 / (i + 1),
        source_conversations: [],
        observed_at: now,
        occurred_at: null,
        status: "active",
      }))) as never);

    const out = await memoryScopedSearch("compression", {
      limit: 5,
      memory_types: ["semantic"],
    });
    expect(out.limit).toBe(5);
    expect(out.results.length).toBe(5);
    expect(searchSemanticMemoryFtsMock).toHaveBeenCalledWith("compression", { limit: 5 });
  });

  it("memory_types restricts which sources are queried", async () => {
    const now = new Date("2026-05-26T12:00:00+08:00");
    searchSemanticMemoryFtsMock.mockImplementation((async () => [
      {
        id: 1001,
        content: "compression semantic only",
        type: "world",
        pinned: false,
        rank: 0.9,
        source_conversations: [],
        observed_at: now,
        occurred_at: null,
        status: "active",
      },
    ]) as never);
    searchMessagesFtsMock.mockImplementation(async () => [
      {
        message_id: "msg-001",
        conversation_id: "sid",
        role: "user",
        content: "compression conversation",
        timestamp: now.toISOString(),
        rank: 0.8,
      },
    ]);

    const out = await memoryScopedSearch("compression", {
      limit: 10,
      memory_types: ["semantic"],
    });
    expect(out.results.every((r) => r.memory_type === "semantic")).toBe(true);
    expect(searchSemanticMemoryFtsMock).toHaveBeenCalled();
    expect(searchMessagesFtsMock).not.toHaveBeenCalled();
    expect(searchLimbicMemoryFtsMock).not.toHaveBeenCalled();
    expect(searchAutobiographicalMemoryFtsMock).not.toHaveBeenCalled();
  });
});
