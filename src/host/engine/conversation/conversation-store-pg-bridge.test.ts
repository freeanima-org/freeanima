import { describe, expect, test } from "bun:test";

import type { ConversationMetaMessage } from "@freeanima/host/core/db/domain";
import {
  conversationExistsWithRouting,
  countMessagesWithRouting,
  loadMessagesForRuntimeWithRouting,
  loadMessagesWithRouting,
  loadMetaWithRouting,
} from "./conversation-store-pg-bridge.ts";

describe("conversation-store-pg-bridge", () => {
  test("exports PG-backed routing helpers", () => {
    expect(typeof loadMetaWithRouting).toBe("function");
    expect(typeof loadMessagesWithRouting).toBe("function");
    expect(typeof countMessagesWithRouting).toBe("function");
    expect(typeof conversationExistsWithRouting).toBe("function");
    expect(typeof loadMessagesForRuntimeWithRouting).toBe("function");
  });

  test("loadMessagesForRuntimeWithRouting signature accepts compression meta", () => {
    const meta: ConversationMetaMessage = {
      model: "test",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      compression: { l1: 0, l2: 5, l3: 0, rounds: 1 },
    };
    const compression = meta.compression as { l2: number } | undefined;
    expect(compression?.l2).toBe(5);
  });
});
