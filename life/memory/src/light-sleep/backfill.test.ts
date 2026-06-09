import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
import {
  addCstDay,
  enumerateCstDays,
  resolveBackfillDayRange,
  runLightSleepBackfill,
} from "./backfill.ts";
import { writeLightSleepBackfillState } from "./backfill-state.ts";

function createSessionStore(earliestDay: string | null): SessionStorePort {
  return {
    getEarliestSessionDay: async () => earliestDay,
    listSessionIdsUpdatedBetween: async () => ["s-1"],
    getSessionMetaLite: async () => ({
      role: "session_meta",
      title: "测试",
      platform: "webui",
      timestamp: "2026-01-01T10:00:00+08:00",
    }),
    listMessages: async () => [{ role: "user", content: "hello", t: "2026-01-01T10:00:00+08:00" }],
  } as unknown as SessionStorePort;
}

function createSemanticStore(): SemanticMemoryStorePort {
  return {
    listResident: async () => [],
    listBySourceSessions: async () => [],
  } as unknown as SemanticMemoryStorePort;
}

function createLimbicStore(): LimbicMemoryStorePort {
  return { listBySession: async () => [] } as unknown as LimbicMemoryStorePort;
}

function createAutoStore(): AutobiographicalMemoryStorePort {
  return { listActive: async () => [] } as unknown as AutobiographicalMemoryStorePort;
}

describe("enumerateCstDays", () => {
  it("逐日枚举含起止", () => {
    expect(enumerateCstDays("2026-01-01", "2026-01-03")).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });

  it("fromDay > toDay 返回空", () => {
    expect(enumerateCstDays("2026-01-05", "2026-01-01")).toEqual([]);
  });
});

describe("addCstDay", () => {
  it("跨月递增", () => {
    expect(addCstDay("2026-01-31")).toBe("2026-02-01");
  });
});

describe("resolveBackfillDayRange", () => {
  it("默认 from 取最早 session 日", async () => {
    const range = await resolveBackfillDayRange(createSessionStore("2026-03-01"), {
      toDay: "2026-03-05",
    });
    expect(range.from_day).toBe("2026-03-01");
    expect(range.to_day).toBe("2026-03-05");
  });

  it("无 session 时抛错", async () => {
    await expect(resolveBackfillDayRange(createSessionStore(null), {})).rejects.toThrow(
      "无可用 session",
    );
  });
});

describe("runLightSleepBackfill", () => {
  let homeDir: string;
  const prevHome = process.env.FREEANIMA_HOME;
  let refreshSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), "backfill-test-"));
    process.env.FREEANIMA_HOME = homeDir;

    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();

    registerMemorySessionStore(createSessionStore("2026-01-01"));
    registerSemanticMemoryStore(createSemanticStore());
    registerLimbicMemoryStore(createLimbicStore());
    registerAutobiographicalMemoryStore(createAutoStore());

    registerLightSleepEngine(async (input) => {
      const isSemantic = input.toolNames.includes("memory_semantic_create");
      return {
        summary: isSemantic ? "语义" : "感性",
        tool_calls: 0,
        semantic_memory_ids: [],
        limbic_memory_ids: [],
      };
    });

    registerAutobiographyEngine(async () => ({
      summary: "自传",
      tool_calls: 0,
    }));

    refreshSpy = mock(async () => true);
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    rmSync(homeDir, { recursive: true, force: true });
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    resetLightSleepEngineForTests();
    resetAutobiographyEngineForTests();
  });

  it("按日补跑且仅末次刷新 summary", async () => {
    const selfStore = { updateBlock: refreshSpy } as unknown as SelfLayerStorePort;

    const result = await runLightSleepBackfill({
      sessionStore: createSessionStore("2026-01-01"),
      autoStore: createAutoStore(),
      selfStore,
      selfContent: "self",
      fromDay: "2026-01-01",
      toDay: "2026-01-03",
    });

    expect(result.ok).toBe(true);
    expect(result.days_total).toBe(3);
    expect(result.days_completed).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.results[0]?.summary_refreshed).toBe(false);
    expect(result.results[1]?.summary_refreshed).toBe(false);
    expect(result.results[2]?.summary_refreshed).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("resume 跳过已完成日", async () => {
    writeLightSleepBackfillState({
      from_day: "2026-01-01",
      to_day: "2026-01-03",
      completed_days: ["2026-01-01", "2026-01-02"],
    });

    const result = await runLightSleepBackfill({
      sessionStore: createSessionStore("2026-01-01"),
      autoStore: createAutoStore(),
      selfContent: "self",
      fromDay: "2026-01-01",
      toDay: "2026-01-03",
      resume: true,
    });

    expect(result.days_skipped).toBe(2);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.day).toBe("2026-01-03");
  });

  it("写入进度文件", async () => {
    await runLightSleepBackfill({
      sessionStore: createSessionStore("2026-01-01"),
      autoStore: createAutoStore(),
      selfContent: "self",
      fromDay: "2026-01-01",
      toDay: "2026-01-02",
    });

    const statePath = join(homeDir, "runtime", "light_sleep_backfill_state.json");
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, "utf-8")) as {
      completed_days: string[];
    };
    expect(state.completed_days).toEqual(["2026-01-01", "2026-01-02"]);
  });
});
