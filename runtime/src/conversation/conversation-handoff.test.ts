import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import type { StoredMessage, ConversationMetaMessage } from "@freeanima/core/db/domain";
import * as compress from "@freeanima/core/compress";
import { nullPgRepositories } from "@freeanima/core/repos";
import * as conversation from "./conversation.ts";
import { generateConversationHandoffSummary } from "./conversation-handoff.ts";

const baseMeta: ConversationMetaMessage = {
  role: "conversation_meta",
  model: "test-model",
  cached_toolsets: [],
  staged_toolsets: [],
  functions: [],
  timestamp: "2026-06-09T00:00:00+08:00",
  system_prompt: "system snapshot",
};

describe("generateConversationHandoffSummary", () => {
  beforeEach(() => {
    spyOn(conversation, "load").mockResolvedValue([]);
    spyOn(conversation, "loadConversationMeta").mockResolvedValue(baseMeta);
    spyOn(compress, "generateConversationSummary").mockResolvedValue({
      ok: true as const,
      summary: "generated",
    });
  });

  it("skips when no conversation content", async () => {
    const result = await generateConversationHandoffSummary(nullPgRepositories, "sid");
    expect(result).toEqual({ ok: false, error: "No conversation content" });
    expect(compress.generateConversationSummary).not.toHaveBeenCalled();
  });

  it("short-circuits when compression summary covers full history", async () => {
    spyOn(conversation, "load").mockResolvedValue([
      { role: "user", content: "u", pos: 1 },
      { role: "assistant", content: "a", pos: 2 },
    ] as StoredMessage[]);
    spyOn(conversation, "loadConversationMeta").mockResolvedValue({
      ...baseMeta,
      compression: {
        l2: 2,
        l3: 2,
        summary: "Existing summary",
        summary_at: "2026-06-09T00:00:00+08:00",
      },
    });

    const result = await generateConversationHandoffSummary(nullPgRepositories, "sid");
    expect(result).toEqual({ ok: true, summary: "Existing summary" });
    expect(compress.generateConversationSummary).not.toHaveBeenCalled();
  });

  it("otherwise calls generateConversationSummary for incremental merge", async () => {
    spyOn(conversation, "load").mockResolvedValue([
      { role: "user", content: "u1", pos: 1 },
      { role: "assistant", content: "a1", pos: 2 },
      { role: "user", content: "u2", pos: 3 },
      { role: "assistant", content: "a2", pos: 4 },
    ] as StoredMessage[]);
    spyOn(conversation, "loadConversationMeta").mockResolvedValue({
      ...baseMeta,
      compression: {
        l2: 2,
        l3: 2,
        summary: "Partial summary",
        summary_at: "2026-06-09T00:00:00+08:00",
      },
    });

    const result = await generateConversationHandoffSummary(nullPgRepositories, "sid");
    expect(result).toEqual({ ok: true, summary: "generated" });
    expect(compress.generateConversationSummary).toHaveBeenCalledTimes(1);
    expect(compress.generateConversationSummary).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ l2: 2, l3: 2, summary: "Partial summary" }),
      { l2: 4, l3: 4 },
      "system snapshot",
      "test-model",
    );
  });
});
