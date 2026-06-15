import { afterEach, describe, expect, it, mock } from "bun:test";

import type {
  DreamMemoryCreateInput,
  DreamMemoryStorePort,
  SessionStorePort,
} from "@freeanima/core/repos";

import { registerDreamEngine, resetDreamEngineForTests } from "../dream-engine-port.ts";
import { registerDreamMemoryStore, resetDreamMemoryStoreForTests } from "../dream-port.ts";
import { registerLimbicMemoryStore, resetLimbicMemoryStoreForTests } from "../limbic-port.ts";
import { registerMemorySessionStore, resetMemorySessionStoreForTests } from "../session-port.ts";
import { runDream, type DreamFridgePort } from "./run.ts";

const DAY = "2026-06-14";

function setupStores(opts: {
  existingDream?: boolean;
  limbicIntensity?: number;
  fridge?: DreamFridgePort;
}) {
  const created: Array<Record<string, unknown>> = [];
  let setReminderCalled = false;

  const dreamStore: DreamMemoryStorePort = {
    async create(row: DreamMemoryCreateInput) {
      created.push(row as Record<string, unknown>);
      return "dream-1";
    },
    async getByDay(day: string) {
      if (opts.existingDream && day === DAY) {
        return {
          id: "existing",
          dream_day: DAY,
          content: "old dream",
          source_limbic_ids: [],
          source_session_ids: [],
          episodic_snippets: [],
          created: "2026-06-15T02:00:00+08:00",
        };
      }
      return null;
    },
    async getLatest() {
      return null;
    },
    async list() {
      return [];
    },
    async count() {
      return 0;
    },
  };

  registerDreamMemoryStore(dreamStore);
  registerLimbicMemoryStore({
    async listBySessions() {
      const intensity = opts.limbicIntensity ?? 0.8;
      if (intensity <= 0.5) return [];
      return [
        {
          id: "limbic-1",
          session_id: "s1",
          kind: "spike",
          valence: 0.1,
          arousal: 0.8,
          content: "strong feeling",
          intensity,
          source_segment: null,
          semantic_memory_ids: [],
          created: "2026-06-14T22:00:00+08:00",
        },
      ];
    },
  } as never);

  registerMemorySessionStore({
    async listSessionIdsUpdatedBetween() {
      return ["s1"];
    },
    async listMessages() {
      return [
        {
          role: "user",
          content: "today was intense",
          timestamp: "2026-06-14T20:00:00+08:00",
        },
      ];
    },
  } as unknown as SessionStorePort);

  registerDreamEngine(async () => ({ content: "A surreal corridor of light…" }));

  const fridge: DreamFridgePort = opts.fridge ?? {
    setReminder: mock(async () => {
      setReminderCalled = true;
    }),
    dismissReminder: mock(async () => {}),
  };

  return { created, fridge, getSetReminderCalled: () => setReminderCalled };
}

afterEach(() => {
  resetDreamMemoryStoreForTests();
  resetLimbicMemoryStoreForTests();
  resetMemorySessionStoreForTests();
  resetDreamEngineForTests();
});

describe("runDream", () => {
  it("creates dream and sets fridge reminder when emotional fuel exists", async () => {
    const { created, fridge, getSetReminderCalled } = setupStores({});
    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
      fridge,
    });

    expect(result.ok).toBe(true);
    expect(result.dream_id).toBe("dream-1");
    expect(created).toHaveLength(1);
    expect(created[0]?.dream_day).toBe(DAY);
    expect(getSetReminderCalled()).toBe(true);
  });

  it("skips when no strong emotion", async () => {
    setupStores({ limbicIntensity: 0.4 });
    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
    });
    expect(result.skipped).toBe("no_strong_emotion");
  });

  it("skips when dream already exists for day", async () => {
    setupStores({ existingDream: true });
    const result = await runDream({
      day: DAY,
      selfContent: "I am Anima.",
    });
    expect(result.skipped).toBe("already_dreamed");
  });
});
