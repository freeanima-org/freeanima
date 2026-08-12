import { afterEach, describe, expect, it, mock } from "bun:test";

import type { StoredMessage } from "@freeanima/host/core/db/domain";
import type { BeforeLlmCallContext } from "@freeanima/host/core/hooks/loop";
import type { RuntimeConfig } from "@freeanima/host/core/config";
import {
  bindActiveRuntimeConfig,
  Config,
  resetActiveConfigForTest,
} from "@freeanima/host/core/config";
import { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } from "@freeanima/host/core/llm/runtime-system-turn";

const semanticPassiveRecallSearchDetailed = mock(async () => ({
  hits: [
    {
      memory_type: "semantic" as const,
      score: 0.9,
      semantic_memory_id: 10,
      type: "preference",
      pinned: false,
      content: "likes concise replies",
      source_conversations: [] as string[],
      observed_at: null,
      occurred_at: null,
      status: "active",
    },
  ],
}));

const isCronSession = mock(async () => false);
const listResidentSemanticMemory = mock(async () => []);

mock.module("./search.ts", () => ({
  semanticPassiveRecallSearchDetailed,
}));

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  isCronSession,
}));

mock.module("@freeanima/host/core/db/pg/semantic-memory", () => ({
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
} as RuntimeConfig;

function bindTestConfig(enabled = true): void {
  bindActiveRuntimeConfig(
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
    semanticPassiveRecallSearchDetailed.mockClear();
    isCronSession.mockClear();
    listResidentSemanticMemory.mockClear();
  });

  it("injects runtime assistant when enabled and last message is user", async () => {
    bindTestConfig(true);
    const messages: StoredMessage[] = [
      { role: "user", content: "<time>2026-06-07T17:45</time>\nhello" },
    ];
    const ctx: BeforeLlmCallContext = { conversationId: "c1", messages };

    await createPassiveMemoryRecallHandler()(ctx);

    expect(semanticPassiveRecallSearchDetailed).toHaveBeenCalledWith("hello", {
      limit: 5,
      min_score: 0.016,
      min_relative_score: 0.55,
      debug: false,
    });
    expect(messages).toHaveLength(2);
    const injected = messages[0];
    expect(injected?.role).toBe("assistant");
    if (injected?.role === "assistant") {
      expect(injected.name).toBe(PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME);
    }
  });

  it("records passive_recall debug when llm_debug", async () => {
    bindTestConfig(true);
    const messages: StoredMessage[] = [{ role: "user", content: "hello" }];
    const llmDebugExtras: Record<string, unknown> = {};
    const ctx: BeforeLlmCallContext = {
      conversationId: "c1",
      messages,
      llm_debug: true,
      llmDebugExtras,
    };

    await createPassiveMemoryRecallHandler()(ctx);

    expect(semanticPassiveRecallSearchDetailed).toHaveBeenCalledWith("hello", {
      limit: 5,
      min_score: 0.016,
      min_relative_score: 0.55,
      debug: true,
    });
    expect(llmDebugExtras.passive_recall).toBeDefined();
  });

  it("skips when disabled", async () => {
    bindTestConfig(false);
    const messages: StoredMessage[] = [{ role: "user", content: "hello" }];
    await createPassiveMemoryRecallHandler()({ conversationId: "c1", messages });
    expect(semanticPassiveRecallSearchDetailed).not.toHaveBeenCalled();
    expect(messages).toHaveLength(1);
  });

  it("skips cron sessions", async () => {
    bindTestConfig(true);
    isCronSession.mockResolvedValueOnce(true);
    const messages: StoredMessage[] = [{ role: "user", content: "hello" }];
    await createPassiveMemoryRecallHandler()({ conversationId: "cron-session", messages });
    expect(semanticPassiveRecallSearchDetailed).not.toHaveBeenCalled();
  });
});
