import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  AutobiographicalMemoryStorePort,
  LimbicMemoryStorePort,
  SelfLayerStorePort,
  SessionStorePort,
  SemanticMemoryStorePort,
} from "@freeanima/engine-repos";

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
import { registerMemorySessionStore, resetMemorySessionStoreForTests } from "../session-port.ts";
import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "../semantic-port.ts";
import { buildLimbicUserMessages, LIMBIC_INSTRUCTION } from "./build-messages.ts";
import { runLightSleep } from "./run.ts";

function createSessionStore(): SessionStorePort {
  return {
    listSessionIdsUpdatedBetween: async () => ["s-1"],
    getSessionMetaLite: async () => ({
      role: "session_meta",
      title: "测试",
      platform: "webui",
      timestamp: "2026-06-08T10:00:00+08:00",
    }),
    listMessages: async () => [
      { role: "user", content: "今天聊了很多", t: "2026-06-08T10:00:00+08:00" },
      { role: "assistant", content: "是的", t: "2026-06-08T10:01:00+08:00" },
    ],
  } as unknown as SessionStorePort;
}

function createSemanticStore(): SemanticMemoryStorePort {
  return {
    listResident: async () => [],
    listBySourceSessions: async () => [
      {
        id: "f-000001-abcd",
        content: "我帮张三完成了重构",
        type: "experience",
        pinned: false,
        reference_count: 0,
        source_sessions: ["s-1"],
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
            content: "我帮张三完成了重构",
            type: "experience",
            pinned: false,
            reference_count: 0,
            source_sessions: ["s-1"],
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
    listBySession: async () => [
      {
        id: "limbic-1",
        session_id: "s-1",
        kind: "spike",
        valence: 0.8,
        arousal: 0.7,
        content: "我感到很有成就感",
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
            session_id: "s-1",
            kind: "turning_point",
            valence: 0.5,
            arousal: 0.6,
            content: "我感到转折",
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
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    registerMemorySessionStore(createSessionStore());
    registerSemanticMemoryStore(createSemanticStore());
    registerLimbicMemoryStore(createLimbicStore());
    registerAutobiographicalMemoryStore(createAutoStore());
  });

  afterEach(() => {
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
  });

  it("buildLimbicUserMessages 含对话、已有 limbic 与指令", async () => {
    const messages = await buildLimbicUserMessages(createSessionStore(), ["s-1"]);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain("# 本日对话");
    expect(messages[0]).toContain("今天聊了很多");
    expect(messages[1]).toContain("limbic-1");
    expect(messages[1]).toContain("我感到很有成就感");
    expect(messages[2]).toBe(LIMBIC_INSTRUCTION);
  });

  it("buildLightSleepAutobiographyUserMessages 含对话、semantic、limbic 与已有自传", async () => {
    const messages = await buildLightSleepAutobiographyUserMessages(
      createSessionStore(),
      ["s-1"],
      ["f-000001-abcd"],
      ["limbic-new"],
    );
    expect(messages).toHaveLength(5);
    expect(messages[0]).toContain("# 本日对话");
    expect(messages[1]).toContain("f-000001-abcd");
    expect(messages[1]).toContain("experience");
    expect(messages[2]).toContain("limbic-1");
    expect(messages[2]).toContain("limbic-new");
    expect(messages[3]).toContain("尚无自传体叙事");
    expect(messages[4]).toBe(LIGHT_SLEEP_AUTOBIOGRAPHY_INSTRUCTION);
  });
});

describe("runLightSleep", () => {
  let homeDir: string;
  let lightSleepCalls = 0;
  let autobiographyCalls = 0;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), "anima-light-sleep-"));
    process.env.FREEANIMA_HOME = homeDir;

    lightSleepCalls = 0;
    autobiographyCalls = 0;

    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();

    registerMemorySessionStore(createSessionStore());
    registerSemanticMemoryStore(createSemanticStore());
    registerLimbicMemoryStore(createLimbicStore());
    registerAutobiographicalMemoryStore(createAutoStore());

    registerLightSleepEngine(async (input) => {
      lightSleepCalls += 1;
      const isSemantic = input.toolNames.includes("memory_semantic_create");
      return {
        summary: isSemantic ? "语义完成" : "感性完成",
        tool_calls: 0,
        semantic_memory_ids: [],
        limbic_memory_ids: isSemantic ? [] : ["limbic-new"],
      };
    });

    registerAutobiographyEngine(async () => {
      autobiographyCalls += 1;
      return { summary: "自传完成", tool_calls: 0 };
    });
  });

  afterEach(() => {
    delete process.env.FREEANIMA_HOME;
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();
  });

  it("Stage 1 零工具调用时仍执行 Stage 2 与 Stage 3", async () => {
    const refreshSpy = mock(async () => true);
    const selfStore = {
      updateBlock: refreshSpy,
    } as unknown as SelfLayerStorePort;

    const result = await runLightSleep({
      sessionStore: createSessionStore(),
      autoStore: createAutoStore(),
      selfStore,
      selfContent: "自我层",
      day: "2026-06-08",
    });

    expect(lightSleepCalls).toBe(2);
    expect(autobiographyCalls).toBe(1);
    expect(result.tool_calls).toBe(0);
    expect(result.limbic_tool_calls).toBe(0);
    expect(result.autobiography_tool_calls).toBe(0);
    expect(result.summary_refreshed).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain("语义完成");
    expect(result.summary).toContain("感性完成");
    expect(result.summary).toContain("自传完成");
  });
});
