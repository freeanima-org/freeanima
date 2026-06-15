import { describe, expect, it } from "bun:test";

import type {
  LimbicListBySessionsOpts,
  LimbicMemoryRow,
  SessionStorePort,
} from "@freeanima/core/repos";

import { DREAM_MIN_INTENSITY, gatherDreamInput, hasDreamFuel } from "./gather-input.ts";
import { registerLimbicMemoryStore, resetLimbicMemoryStoreForTests } from "../limbic-port.ts";
import { registerMemorySessionStore, resetMemorySessionStoreForTests } from "../session-port.ts";

function limbicRow(id: string, intensity: number, sessionId = "s1"): LimbicMemoryRow {
  return {
    id,
    session_id: sessionId,
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

describe("gatherDreamInput", () => {
  it("returns top limbic rows above intensity threshold", async () => {
    resetLimbicMemoryStoreForTests();
    resetMemorySessionStoreForTests();

    const limbicRows = [
      limbicRow("a", 0.9),
      limbicRow("b", 0.6),
      limbicRow("c", 0.55),
      limbicRow("d", 0.4),
    ];

    registerLimbicMemoryStore({
      async listBySessions(_sessionIds: string[], opts?: LimbicListBySessionsOpts) {
        expect(opts?.minIntensity).toBe(DREAM_MIN_INTENSITY);
        return limbicRows
          .filter((r) => r.intensity > (opts?.minIntensity ?? 0))
          .sort((x, y) => y.intensity - x.intensity)
          .slice(0, opts?.limit ?? 3);
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
            content: "hello dream",
            timestamp: "2026-06-14T12:00:00+08:00",
          },
        ];
      },
    } as unknown as SessionStorePort);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.limbicMemories.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(input.episodicSnippets.length).toBeGreaterThan(0);
    expect(hasDreamFuel(input)).toBe(true);
  });

  it("has no dream fuel when limbic below threshold", async () => {
    resetLimbicMemoryStoreForTests();
    resetMemorySessionStoreForTests();

    registerLimbicMemoryStore({
      async listBySessions(_sessionIds: string[], opts?: LimbicListBySessionsOpts) {
        const min = opts?.minIntensity ?? 0;
        const row = limbicRow("low", 0.3);
        return row.intensity > min ? [row] : [];
      },
    } as never);

    registerMemorySessionStore({
      async listSessionIdsUpdatedBetween() {
        return ["s1"];
      },
      async listMessages() {
        return [];
      },
    } as unknown as SessionStorePort);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.limbicMemories).toEqual([]);
    expect(hasDreamFuel(input)).toBe(false);
  });
});
