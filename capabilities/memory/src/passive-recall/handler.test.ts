import { afterEach, describe, expect, it, mock } from "bun:test";

import type { StoredMessage } from "@freeanima/core/db/domain";
import type { BeforeLlmCallContext } from "@freeanima/core/hooks/loop";
import type { AnimaConfig } from "@freeanima/core/config";
import { bindActiveConfig, Config, resetActiveConfigForTest } from "@freeanima/core/config";
import { PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME } from "@freeanima/core/llm/runtime-system-turn";

const semanticPassiveRecallSearch = mock(async () => [
  {
    memory_type: "semantic" as const,
    score: 0.9,
    semantic_memory_id: "f-000010-dead",
    type: "preference",
    pinned: false,
    content: "likes concise replies",
    source_conversations: [],
    observed_at: null,
    occurred_at: null,
    status: "active",
  },
]);

const isCronSession = mock(async () => false);
const listResidentSemanticMemory = mock(async () => []);

mock.module("./search.ts", () => ({
  semanticPassiveRecallSearch,
}));

mock.module("@freeanima/core/db/pg/conversation", () => ({
  isCronSession,
}));

mock.module("@freeanima/core/db/pg/semantic-memory", () => ({
  listResidentSemanticMemory,
}));

const { createPassiveMemoryRecallHandler } = await import("./handler.ts");

const baseConfig = {
  llm: {
    default_profile: "chat",
    providers: {
      main: { backend: "openai_compatible" as const, base_url: "https://api.example/v1" },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "m" }] } },
  },
} as AnimaConfig;

function bindTestConfig(enabled = true): void {
  bindActiveConfig(
    Config.fromSnapshot({
      ...baseConfig,
      memory: {
        passive_recall: { enabled, limit: 5, max_chars: 2000, exclude_resident: true },
      },
    }),
  );
}

describe("createPassiveMemoryRecallHandler", () => {
  afterEach(() => {
    resetActiveConfigForTest();
    semanticPassiveRecallSearch.mockClear();
    isCronSession.mockClear();
    listResidentSemanticMemory.mockClear();
  });

  it("injects runtime system when enabled and last message is user", async () => {
    bindTestConfig(true);
    const messages: StoredMessage[] = [{ role: "user", content: "time: 2026-06-07T17:45\nhello" }];
    const ctx: BeforeLlmCallContext = { conversationId: "c1", messages };

    await createPassiveMemoryRecallHandler()(ctx);

    expect(semanticPassiveRecallSearch).toHaveBeenCalledWith("hello", {
      limit: 5,
      min_score: 0.016,
      min_relative_score: 0.55,
    });
    expect(messages).toHaveLength(2);
    const injected = messages[0];
    expect(injected?.role).toBe("system");
    if (injected?.role === "system") {
      expect(injected.name).toBe(PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME);
    }
  });

  it("skips when disabled", async () => {
    bindTestConfig(false);
    const messages: StoredMessage[] = [{ role: "user", content: "hello" }];
    await createPassiveMemoryRecallHandler()({ conversationId: "c1", messages });
    expect(semanticPassiveRecallSearch).not.toHaveBeenCalled();
    expect(messages).toHaveLength(1);
  });

  it("skips cron sessions", async () => {
    bindTestConfig(true);
    isCronSession.mockResolvedValueOnce(true);
    const messages: StoredMessage[] = [{ role: "user", content: "hello" }];
    await createPassiveMemoryRecallHandler()({ conversationId: "cron-session", messages });
    expect(semanticPassiveRecallSearch).not.toHaveBeenCalled();
  });
});
