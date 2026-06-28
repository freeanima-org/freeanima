import { describe, expect, test } from "bun:test";

import type { ConversationMetaMessage } from "@freeanima/core/db/domain";
import type { PgRepositories } from "@freeanima/core/repos";
import { nullPgRepositories } from "@freeanima/core/repos";
import {
  conversationExistsWithRouting,
  countMessagesWithRouting,
  loadMessagesForRuntimeWithRouting,
  loadMessagesWithRouting,
  loadMetaWithRouting,
  postgresAvailable,
} from "./conversation-store-pg-bridge.ts";

describe("conversation-store-pg-bridge", () => {
  test("postgresAvailable reflects null repos", () => {
    expect(postgresAvailable(nullPgRepositories)).toBe(false);
  });

  test("read routes return empty when PG unavailable", async () => {
    expect(await loadMetaWithRouting(nullPgRepositories, "s1")).toEqual({});
    expect(await loadMessagesWithRouting(nullPgRepositories, "s1")).toEqual([]);
    expect(await countMessagesWithRouting(nullPgRepositories, "s1")).toBe(0);
    expect(await conversationExistsWithRouting(nullPgRepositories, "s1")).toBe(false);
  });

  test("loadMessagesForRuntimeWithRouting uses pos window when compressed", async () => {
    const repos = {
      ...nullPgRepositories,
      pgAvailable: true,
      conversation: {
        ...nullPgRepositories.conversation,
        listMessagesByPosRange: async () => [{ role: "user" as const, content: "tail" }],
        listMessages: async () => [{ role: "user" as const, content: "full" }],
      },
    } satisfies PgRepositories;
    const meta: ConversationMetaMessage = {
      role: "conversation_meta",
      model: "test",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      compression: { l1: 0, l2: 5, l3: 0, rounds: 1 },
    };
    const msgs = await loadMessagesForRuntimeWithRouting(repos, "s1", meta);
    expect(msgs).toEqual([{ role: "user", content: "tail" }]);
  });

  test("loadMessagesForRuntimeWithRouting falls back to full list without compression", async () => {
    const repos = {
      ...nullPgRepositories,
      pgAvailable: true,
      conversation: {
        ...nullPgRepositories.conversation,
        listMessages: async () => [{ role: "user" as const, content: "full" }],
      },
    } satisfies PgRepositories;
    const msgs = await loadMessagesForRuntimeWithRouting(repos, "s1", {});
    expect(msgs).toEqual([{ role: "user", content: "full" }]);
  });
});
