import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";
import type { LimbicMemoryRow, SemanticMemoryRow } from "@freeanima/host/core/db/schema/rows";

import {
  buildLightSleepAutobiographyUserMessages,
  LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION,
} from "../autobiography/build-messages.ts";
import {
  registerAutobiographyEngine,
  resetAutobiographyEngineForTests,
} from "../autobiography-port.ts";
import { registerLightSleepEngine, resetLightSleepEngineForTests } from "../light-sleep-port.ts";
import {
  buildLimbicUserMessages,
  collectConversationBlocks,
  cstDayRange,
  filterMessagesInDayRange,
  formatDialogueMessage,
  LIMBIC_INSTRUCTION,
} from "./build-messages.ts";
import { runLightSleep } from "./run.ts";

const listConversationIdsUpdatedBetweenMock = mock(async () => ["s-1"]);
const getConversationMetaLiteMock = mock(async () => ({
  role: "conversation_meta",
  title: "Test",
  platform: "console",
  timestamp: "2026-06-08T10:00:00+08:00",
}));
const listMessagesMock = mock(async () => [
  { role: "user", content: "We talked a lot today", timestamp: "2026-06-08T10:00:00+08:00" },
  { role: "assistant", content: "Yes", timestamp: "2026-06-08T10:01:00+08:00" },
]);
const listSemanticMemoryBySourceSessionsMock = mock(async () => [
  {
    id: 1001,
    content: "I helped Zhang San complete a refactor",
    type: "experience",
    pinned: false,
    reference_count: 0,
    source_conversations: ["s-1"],
    observed_at: new Date("2026-06-08T10:00:00+08:00"),
    occurred_at: null,
    status: "active",
    world_id: 1,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  } as SemanticMemoryRow,
]);
const listLimbicMemoryBySessionMock = mock(async () => [
  {
    id: "limbic-1",
    conversation_id: "s-1",
    kind: "spike",
    valence: 0.8,
    arousal: 0.7,
    content: "I felt a strong sense of accomplishment",
    intensity: 0.8,
    source_segment: "late",
    semantic_memory_ids: [1001],
    content_embedding: null,
    content_fts: null,
    fts_segmented: null,
    created_at: new Date("2026-06-08T11:00:00+08:00"),
  } as LimbicMemoryRow,
]);
const getLimbicMemoryMock = mock(async (id: string | number) =>
  id === "limbic-new"
    ? ({
        id,
        conversation_id: "s-1",
        kind: "turning_point",
        valence: 0.5,
        arousal: 0.6,
        content: "I felt a turning point",
        intensity: 0.7,
        source_segment: null,
        semantic_memory_ids: [],
        content_embedding: null,
        content_fts: null,
        fts_segmented: null,
        created_at: new Date("2026-06-08T12:00:00+08:00"),
      } as LimbicMemoryRow)
    : null,
);
const getSemanticMemoryMock = mock(async (id: string | number) =>
  id === 1001 || id === "1001"
    ? ({
        id,
        content: "I helped Zhang San complete a refactor",
        type: "experience",
        pinned: false,
        reference_count: 0,
        source_conversations: ["s-1"],
        observed_at: new Date("2026-06-08T10:00:00+08:00"),
        occurred_at: null,
        status: "active",
        world_id: 1,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
      } as SemanticMemoryRow)
    : null,
);
const listActiveAutobiographicalMemoryMock = mock(async () => []);
const updateSelfBlockMock = mock(async () => true);

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  listConversationIdsUpdatedBetween: listConversationIdsUpdatedBetweenMock,
  getConversationMetaLite: getConversationMetaLiteMock,
  listMessages: listMessagesMock,
}));
mock.module("@freeanima/host/core/db/pg/semantic-memory", () => ({
  listSemanticMemoryBySourceSessions: listSemanticMemoryBySourceSessionsMock,
  getSemanticMemory: getSemanticMemoryMock,
  listResidentSemanticMemory: mock(async () => []),
}));
mock.module("@freeanima/host/core/db/pg/limbic-memory", () => ({
  listLimbicMemoryBySession: listLimbicMemoryBySessionMock,
  getLimbicMemory: getLimbicMemoryMock,
}));
mock.module("@freeanima/host/core/db/pg/autobiographical-memory", () => ({
  listActiveAutobiographicalMemory: listActiveAutobiographicalMemoryMock,
}));
mock.module("@freeanima/host/core/db/pg/self-layer", () => ({
  updateSelfBlock: updateSelfBlockMock,
}));

describe("light-sleep build-messages", () => {
  it("buildLimbicUserMessages includes dialogue, existing limbic, and instruction", async () => {
    const messages = await buildLimbicUserMessages(["s-1"], undefined, cstDayRange("2026-06-08"));
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain("# Today's dialogue");
    expect(messages[0]).toContain("We talked a lot today");
    expect(messages[1]).toContain("limbic-1");
    expect(messages[1]).toContain("I felt a strong sense of accomplishment");
    expect(messages[2]).toBe(LIMBIC_INSTRUCTION);
  });

  it("filterMessagesInDayRange keeps only messages in [fromIso, toIso)", () => {
    const range = cstDayRange("2026-06-08");
    const filtered = filterMessagesInDayRange(
      [
        { t: "2026-06-07T23:59:59+08:00", role: "user", content: "yesterday" },
        { t: "2026-06-08T10:00:00+08:00", role: "user", content: "today" },
        { t: "2026-06-09T00:00:00+08:00", role: "user", content: "tomorrow" },
      ],
      range,
    );
    expect(filtered.map((m) => m.content)).toEqual(["today"]);
  });

  it("collectConversationBlocks drops sessions with no messages in the day window", async () => {
    listMessagesMock.mockImplementationOnce(async () => [
      { role: "user", content: "old talk", timestamp: "2026-06-01T10:00:00+08:00" },
      { role: "assistant", content: "old reply", timestamp: "2026-06-01T10:01:00+08:00" },
    ]);
    const blocks = await collectConversationBlocks(["s-1"], cstDayRange("2026-06-08"));
    expect(blocks).toHaveLength(0);
    expect(formatDialogueMessage(blocks).text).toContain("No valid dialogue");
  });

  it("collectConversationBlocks keeps only same-day messages from a multi-day session", async () => {
    listMessagesMock.mockImplementationOnce(async () => [
      { role: "user", content: "past feeling", timestamp: "2026-06-07T15:00:00+08:00" },
      { role: "assistant", content: "past reply", timestamp: "2026-06-07T15:01:00+08:00" },
      { role: "user", content: "today only", timestamp: "2026-06-08T10:00:00+08:00" },
      { role: "assistant", content: "today reply", timestamp: "2026-06-08T10:01:00+08:00" },
    ]);
    const blocks = await collectConversationBlocks(["s-1"], cstDayRange("2026-06-08"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.text).toContain("today only");
    expect(blocks[0]?.text).toContain("today reply");
    expect(blocks[0]?.text).not.toContain("past feeling");
  });

  it("buildLightSleepAutobiographyUserMessages includes dialogue, semantic, limbic, and existing autobiography", async () => {
    const messages = await buildLightSleepAutobiographyUserMessages(
      ["s-1"],
      [1001],
      ["limbic-new"],
      undefined,
      cstDayRange("2026-06-08"),
    );
    expect(messages).toHaveLength(5);
    expect(messages[0]).toContain("# Today's dialogue");
    expect(messages[1]).toContain('"id":1001');
    expect(messages[1]).toContain("experience");
    expect(messages[2]).toContain("limbic-1");
    expect(messages[2]).toContain("limbic-new");
    expect(messages[3]).toContain("No autobiographical narratives yet");
    expect(messages[4]).toBe(LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION);
  });
});

describe("runLightSleep", () => {
  let homeDir: string;
  let lightSleepCalls = 0;
  let autobiographyCalls = 0;

  beforeEach(() => {
    homeDir = createTempDir("anima-light-sleep-");
    process.env.FREEANIMA_HOME = homeDir;

    lightSleepCalls = 0;
    autobiographyCalls = 0;
    updateSelfBlockMock.mockClear();

    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();

    registerLightSleepEngine(async (input) => {
      lightSleepCalls += 1;
      expect(input.stage === "semantic" || input.stage === "limbic").toBe(true);
      const isSemantic = input.stage === "semantic";
      return {
        summary: isSemantic ? "semantic done" : "limbic done",
        tool_calls: 0,
        semantic_memory_ids: [],
        limbic_memory_ids: isSemantic ? [] : ["limbic-new"],
      };
    });

    registerAutobiographyEngine(async () => {
      autobiographyCalls += 1;
      return { summary: "autobiography done", tool_calls: 0 };
    });
  });

  afterEach(() => {
    delete process.env.FREEANIMA_HOME;
    removeTempDir(homeDir);
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();
  });

  it("Stage 1 with zero tool calls still runs Stage 2 and Stage 3", async () => {
    const result = await runLightSleep({
      selfContent: "self layer",
      day: "2026-06-08",
    });

    expect(lightSleepCalls).toBe(2);
    expect(autobiographyCalls).toBe(1);
    expect(result.tool_calls).toBe(0);
    expect(result.limbic_tool_calls).toBe(0);
    expect(result.autobiography_tool_calls).toBe(0);
    expect(result.summary_refreshed).toBe(true);
    expect(updateSelfBlockMock).toHaveBeenCalled();
    expect(result.summary).toContain("semantic done");
    expect(result.summary).toContain("limbic done");
    expect(result.summary).toContain("autobiography done");
  });
});
