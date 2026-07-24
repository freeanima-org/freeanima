import { afterEach, describe, expect, it, mock } from "bun:test";

import type { DreamEntryCreateInput } from "@freeanima/host/core/db/pg/dream";
import { registerDreamEngine, resetDreamEngineForTests } from "../dream-engine-port.ts";
import { runDream } from "./run.ts";

const DAY = "2026-06-14";
const created: Array<Record<string, unknown>> = [];

const createDreamEntryMock = mock(async (_ctx: { worldId: number }, row: DreamEntryCreateInput) => {
  created.push(row as Record<string, unknown>);
  return {
    id: 1,
    dream_day: row.dream_day,
    content: row.content,
    source_limbic_ids: row.source_limbic_ids ?? [],
    source_conversation_ids: row.source_conversation_ids ?? [],
    episodic_snippets: row.episodic_snippets ?? [],
    created_at: "2026-06-15T02:00:00+08:00",
  };
});

const getDreamEntryByDayMock = mock(async (_ctx: { worldId: number }, day: string) => {
  if (day === DAY && existingDream) {
    return {
      id: 99,
      dream_day: DAY,
      content: "old dream",
      source_limbic_ids: [],
      source_conversation_ids: [],
      episodic_snippets: [],
      created_at: "2026-06-15T02:00:00+08:00",
    };
  }
  return null;
});

let existingDream = false;
let limbicIntensity = 0.8;
let noSessions = false;

const listLimbicMemoryByCreatedBetweenMock = mock(async () => {
  if (limbicIntensity <= 0.5) return [];
  return [
    {
      id: "limbic-1",
      conversation_id: "s1",
      kind: "spike",
      valence: 0.1,
      arousal: 0.8,
      content: "strong feeling",
      intensity: limbicIntensity,
      source_segment: null,
      semantic_memory_ids: [],
      created_at: new Date("2026-06-14T22:00:00+08:00"),
    },
  ];
});

const listConversationIdsUpdatedBetweenMock = mock(async () => (noSessions ? [] : ["s1"]));
const listMessagesMock = mock(async () => [
  {
    role: "user",
    content: "today was intense",
    t: "2026-06-14T20:00:00+08:00",
  },
]);

mock.module("@freeanima/host/core/db/pg/dream", () => ({
  createDreamEntry: createDreamEntryMock,
  getDreamEntryByDay: getDreamEntryByDayMock,
  resolveDreamWorldId: mock(async () => 100),
}));
mock.module("@freeanima/host/core/db/pg/limbic-memory", () => ({
  listLimbicMemoryByCreatedBetween: listLimbicMemoryByCreatedBetweenMock,
}));
mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  listConversationIdsUpdatedBetween: listConversationIdsUpdatedBetweenMock,
  listRecentMessages: listMessagesMock,
}));

afterEach(() => {
  created.length = 0;
  existingDream = false;
  limbicIntensity = 0.8;
  noSessions = false;
  createDreamEntryMock.mockClear();
  getDreamEntryByDayMock.mockClear();
  resetDreamEngineForTests();
});

describe("runDream", () => {
  it("creates dream when emotional fuel exists", async () => {
    registerDreamEngine(async () => ({ content: "A surreal corridor of light…" }));

    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
    });

    expect(result.ok).toBe(true);
    expect(result.dream_id).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]?.dream_day).toBe(DAY);
  });

  it("creates dream without conversations when limbic fuel exists", async () => {
    noSessions = true;
    registerDreamEngine(async () => ({ content: "A surreal corridor of light…" }));

    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
    });

    expect(result.ok).toBe(true);
    expect(result.dream_id).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0]?.source_conversation_ids).toEqual([]);
    expect(created[0]?.episodic_snippets).toEqual([]);
  });

  it("skips when no strong emotion", async () => {
    limbicIntensity = 0.4;
    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
    });
    expect(result.skipped).toBe("no_strong_emotion");
  });

  it("skips when dream already exists for day", async () => {
    existingDream = true;
    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
    });
    expect(result.skipped).toBe("already_dreamed");
  });
});
