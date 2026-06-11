import { describe, it, expect, mock, beforeEach, afterAll } from "bun:test";
import type { SessionMessage, SessionMetaMessage } from "@freeanima/engine-db/domain";
import { nullPgRepositories } from "@freeanima/engine-repos";
import * as compressActual from "@freeanima/engine-compress";

const loadMock = mock(async (): Promise<SessionMessage[]> => []);
const loadSessionMetaMock = mock(async (): Promise<SessionMetaMessage | null> => null);
const generateSessionSummaryMock = mock(async () => ({ ok: true as const, summary: "generated" }));

mock.module("./conversation.ts", () => ({
  load: loadMock,
  loadSessionMeta: loadSessionMetaMock,
}));

mock.module("@freeanima/engine-compress", () => ({
  ...compressActual,
  generateSessionSummary: generateSessionSummaryMock,
}));

const { generateSessionHandoffSummary } = await import("./session-handoff.ts");

const baseMeta: SessionMetaMessage = {
  role: "session_meta",
  model: "test-model",
  tools: [],
  loaded_tools: [],
  functions: [],
  timestamp: "2026-06-09T00:00:00+08:00",
  system_prompt: "system snapshot",
};

describe("generateSessionHandoffSummary", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    loadMock.mockReset();
    loadSessionMetaMock.mockReset();
    generateSessionSummaryMock.mockReset();
    generateSessionSummaryMock.mockResolvedValue({ ok: true, summary: "generated" });
  });

  it("skips when no conversation content", async () => {
    loadMock.mockResolvedValue([]);
    loadSessionMetaMock.mockResolvedValue(baseMeta);

    const result = await generateSessionHandoffSummary(nullPgRepositories, "sid");
    expect(result).toEqual({ ok: false, error: "No conversation content" });
    expect(generateSessionSummaryMock).not.toHaveBeenCalled();
  });

  it("short-circuits when compression summary covers full history", async () => {
    loadMock.mockResolvedValue([
      { role: "user", content: "u", pos: 1 },
      { role: "assistant", content: "a", pos: 2 },
    ]);
    loadSessionMetaMock.mockResolvedValue({
      ...baseMeta,
      compression: {
        l2: 2,
        l3: 2,
        summary: "Existing summary",
        summary_at: "2026-06-09T00:00:00+08:00",
      },
    });

    const result = await generateSessionHandoffSummary(nullPgRepositories, "sid");
    expect(result).toEqual({ ok: true, summary: "Existing summary" });
    expect(generateSessionSummaryMock).not.toHaveBeenCalled();
  });

  it("otherwise calls generateSessionSummary for incremental merge", async () => {
    loadMock.mockResolvedValue([
      { role: "user", content: "u1", pos: 1 },
      { role: "assistant", content: "a1", pos: 2 },
      { role: "user", content: "u2", pos: 3 },
      { role: "assistant", content: "a2", pos: 4 },
    ]);
    loadSessionMetaMock.mockResolvedValue({
      ...baseMeta,
      compression: {
        l2: 2,
        l3: 2,
        summary: "Partial summary",
        summary_at: "2026-06-09T00:00:00+08:00",
      },
    });

    const result = await generateSessionHandoffSummary(nullPgRepositories, "sid");
    expect(result).toEqual({ ok: true, summary: "generated" });
    expect(generateSessionSummaryMock).toHaveBeenCalledTimes(1);
    const call = generateSessionSummaryMock.mock.calls[0] as unknown[] | undefined;
    expect(call?.[3]).toBe("system snapshot");
    expect(call?.[4]).toBe("test-model");
    expect(call?.[2]).toEqual({ l2: 4, l3: 4 });
  });
});
