import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import type {
  AutobiographicalMemoryStorePort,
  LimbicMemoryStorePort,
  SelfLayerStorePort,
  ConversationStorePort,
  SemanticMemoryStorePort,
} from "@freeanima/core/repos";

import {
  buildLightSleepAutobiographyUserMessages,
  LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION,
} from "../autobiography/build-messages.ts";
import {
  registerAutobiographicalMemoryStore,
  resetAutobiographicalMemoryStoreForTests,
} from "../autobiographical-port.ts";
import {
  registerAutobiographyEngine,
  resetAutobiographyEngineForTests,
} from "../autobiography-port.ts";
import { registerLimbicMemoryStore, resetLimbicMemoryStoreForTests } from "../limbic-port.ts";
import { registerLightSleepEngine, resetLightSleepEngineForTests } from "../light-sleep-port.ts";
import {
  registerMemoryConversationStore,
  resetMemoryConversationStoreForTests,
} from "../conversation-port.ts";
import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "../semantic-port.ts";
import { buildLimbicUserMessages, LIMBIC_INSTRUCTION } from "./build-messages.ts";
import { runLightSleep } from "./run.ts";

function createSessionStore(): ConversationStorePort {
  return {
    listConversationIdsUpdatedBetween: async () => ["s-1"],
    getConversationMetaLite: async () => ({
      role: "conversation_meta",
      title: "Test",
      platform: "webui",
      timestamp: "2026-06-08T10:00:00+08:00",
    }),
    listMessages: async () => [
      { role: "user", content: "We talked a lot today", t: "2026-06-08T10:00:00+08:00" },
      { role: "assistant", content: "Yes", t: "2026-06-08T10:01:00+08:00" },
    ],
  } as unknown as ConversationStorePort;
}

function createSemanticStore(): SemanticMemoryStorePort {
  return {
    listResident: async () => [],
    listBySourceConversations: async () => [
      {
        id: "f-000001-abcd",
        content: "I helped Zhang San complete a refactor",
        type: "experience",
        pinned: false,
        reference_count: 0,
        source_conversations: ["s-1"],
        observed_at: "2026-06-08T10:00:00+08:00",
        occurred_at: null,
        status: "active",
        created: "",
        updated: "",
      },
    ],
    get: async (id: string) =>
      id === "f-000001-abcd"
        ? {
            id,
            content: "I helped Zhang San complete a refactor",
            type: "experience",
            pinned: false,
            reference_count: 0,
            source_conversations: ["s-1"],
            observed_at: "2026-06-08T10:00:00+08:00",
            occurred_at: null,
            status: "active",
            created: "",
            updated: "",
          }
        : null,
  } as unknown as SemanticMemoryStorePort;
}

function createLimbicStore(): LimbicMemoryStorePort {
  return {
    listByConversation: async () => [
      {
        id: "limbic-1",
        conversation_id: "s-1",
        kind: "spike",
        valence: 0.8,
        arousal: 0.7,
        content: "I felt a strong sense of accomplishment",
        intensity: 0.8,
        source_segment: "late",
        semantic_memory_ids: ["f-000001-abcd"],
        created: "2026-06-08T11:00:00+08:00",
      },
    ],
    get: async (id: string) =>
      id === "limbic-new"
        ? {
            id,
            conversation_id: "s-1",
            kind: "turning_point",
            valence: 0.5,
            arousal: 0.6,
            content: "I felt a turning point",
            intensity: 0.7,
            source_segment: null,
            semantic_memory_ids: [],
            created: "2026-06-08T12:00:00+08:00",
          }
        : null,
  } as unknown as LimbicMemoryStorePort;
}

function createAutoStore(): AutobiographicalMemoryStorePort {
  return {
    listActive: async () => [],
  } as unknown as AutobiographicalMemoryStorePort;
}

describe("light-sleep build-messages", () => {
  beforeEach(() => {
    resetMemoryConversationStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    registerMemoryConversationStore(createSessionStore());
    registerSemanticMemoryStore(createSemanticStore());
    registerLimbicMemoryStore(createLimbicStore());
    registerAutobiographicalMemoryStore(createAutoStore());
  });

  afterEach(() => {
    resetMemoryConversationStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
  });

  it("buildLimbicUserMessages includes dialogue, existing limbic, and instruction", async () => {
    const messages = await buildLimbicUserMessages(createSessionStore(), ["s-1"]);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain("# Today's dialogue");
    expect(messages[0]).toContain("We talked a lot today");
    expect(messages[1]).toContain("limbic-1");
    expect(messages[1]).toContain("I felt a strong sense of accomplishment");
    expect(messages[2]).toBe(LIMBIC_INSTRUCTION);
  });

  it("buildLightSleepAutobiographyUserMessages includes dialogue, semantic, limbic, and existing autobiography", async () => {
    const messages = await buildLightSleepAutobiographyUserMessages(
      createSessionStore(),
      ["s-1"],
      ["f-000001-abcd"],
      ["limbic-new"],
    );
    expect(messages).toHaveLength(5);
    expect(messages[0]).toContain("# Today's dialogue");
    expect(messages[1]).toContain("f-000001-abcd");
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

    resetMemoryConversationStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();

    registerMemoryConversationStore(createSessionStore());
    registerSemanticMemoryStore(createSemanticStore());
    registerLimbicMemoryStore(createLimbicStore());
    registerAutobiographicalMemoryStore(createAutoStore());

    registerLightSleepEngine(async (input) => {
      lightSleepCalls += 1;
      const isSemantic = input.toolNames.includes("memory_semantic_create");
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
    resetMemoryConversationStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();
  });

  it("Stage 1 with zero tool calls still runs Stage 2 and Stage 3", async () => {
    const refreshSpy = mock(async () => true);
    const selfStore = {
      updateBlock: refreshSpy,
    } as unknown as SelfLayerStorePort;

    const result = await runLightSleep({
      conversationStore: createSessionStore(),
      autoStore: createAutoStore(),
      selfStore,
      selfContent: "self layer",
      day: "2026-06-08",
    });

    expect(lightSleepCalls).toBe(2);
    expect(autobiographyCalls).toBe(1);
    expect(result.tool_calls).toBe(0);
    expect(result.limbic_tool_calls).toBe(0);
    expect(result.autobiography_tool_calls).toBe(0);
    expect(result.summary_refreshed).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain("semantic done");
    expect(result.summary).toContain("limbic done");
    expect(result.summary).toContain("autobiography done");
  });
});
