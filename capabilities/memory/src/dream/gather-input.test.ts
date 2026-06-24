import { describe, expect, it } from "bun:test";

import type {
  LimbicListByCreatedOpts,
  LimbicMemoryRow,
  ConversationStorePort,
} from "@freeanima/core/repos";

import {
  DREAM_MIN_INTENSITY,
  gatherDreamInput,
  hasDreamFuel,
  limbicCreatedRange,
} from "./gather-input.ts";
import { registerLimbicMemoryStore, resetLimbicMemoryStoreForTests } from "../limbic-port.ts";
import {
  registerMemoryConversationStore,
  resetMemoryConversationStoreForTests,
} from "../conversation-port.ts";

function limbicRow(id: string, intensity: number, conversationId = "s1"): LimbicMemoryRow {
  return {
    id,
    conversation_id: conversationId,
    kind: "turning_point",
    valence: -0.2,
    arousal: 0.7,
    content: `emotion ${id}`,
    intensity,
    source_segment: null,
    semantic_memory_ids: [],
    created: "2026-06-14T10:00:00+08:00",
  };
}

describe("limbicCreatedRange", () => {
  it("extends conversation-day end by 6 hours for light-sleep writes", () => {
    const range = limbicCreatedRange({
      day: "2026-06-14",
      fromIso: "2026-06-14T00:00:00+08:00",
      toIso: "2026-06-15T00:00:00+08:00",
    });
    expect(range.fromIso).toBe("2026-06-14T00:00:00+08:00");
    expect(range.toIso).toBe("2026-06-15T06:00:00+08:00");
  });
});

describe("gatherDreamInput", () => {
  it("returns top limbic rows above intensity threshold by created_at window", async () => {
    resetLimbicMemoryStoreForTests();
    resetMemoryConversationStoreForTests();

    const limbicRows = [
      limbicRow("a", 0.9),
      limbicRow("b", 0.6),
      limbicRow("c", 0.55),
      limbicRow("d", 0.4),
    ];

    registerLimbicMemoryStore({
      async listByCreatedBetween(fromIso: string, toIso: string, opts?: LimbicListByCreatedOpts) {
        expect(fromIso).toBe("2026-06-14T00:00:00+08:00");
        expect(toIso).toBe("2026-06-15T06:00:00+08:00");
        expect(opts?.minIntensity).toBe(DREAM_MIN_INTENSITY);
        return limbicRows
          .filter((r) => r.intensity > (opts?.minIntensity ?? 0))
          .sort((x, y) => y.intensity - x.intensity)
          .slice(0, opts?.limit ?? 3);
      },
    } as never);

    registerMemoryConversationStore({
      async listConversationIdsUpdatedBetween() {
        return ["s1"];
      },
      async listMessages() {
        return [
          {
            role: "user",
            content: "hello dream",
            timestamp: "2026-06-14T12:00:00+08:00",
          },
        ];
      },
    } as unknown as ConversationStorePort);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.limbicMemories.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(input.episodicSnippets.length).toBeGreaterThan(0);
    expect(hasDreamFuel(input)).toBe(true);
  });

  it("has no dream fuel when limbic below threshold", async () => {
    resetLimbicMemoryStoreForTests();
    resetMemoryConversationStoreForTests();

    registerLimbicMemoryStore({
      async listByCreatedBetween(_fromIso: string, _toIso: string, opts?: LimbicListByCreatedOpts) {
        const min = opts?.minIntensity ?? 0;
        const row = limbicRow("low", 0.3);
        return row.intensity > min ? [row] : [];
      },
    } as never);

    registerMemoryConversationStore({
      async listConversationIdsUpdatedBetween() {
        return ["s1"];
      },
      async listMessages() {
        return [];
      },
    } as unknown as ConversationStorePort);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.limbicMemories).toEqual([]);
    expect(hasDreamFuel(input)).toBe(false);
  });

  it("loads limbic even when no sessions updated that day", async () => {
    resetLimbicMemoryStoreForTests();
    resetMemoryConversationStoreForTests();

    registerLimbicMemoryStore({
      async listByCreatedBetween() {
        return [limbicRow("a", 0.8)];
      },
    } as never);

    registerMemoryConversationStore({
      async listConversationIdsUpdatedBetween() {
        return [];
      },
      async listMessages() {
        return [];
      },
    } as unknown as ConversationStorePort);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.conversationIds).toEqual([]);
    expect(input.limbicMemories).toHaveLength(1);
    expect(input.episodicSnippets).toEqual([]);
    expect(hasDreamFuel(input)).toBe(true);
  });
});
