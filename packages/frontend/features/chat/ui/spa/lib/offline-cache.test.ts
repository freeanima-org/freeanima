import { afterEach, describe, expect, test } from "bun:test";

import {
  readCachedConversations,
  readCachedMessages,
  resolveCacheScope,
  resolveHabitatCacheScope,
  setOfflineCacheBackendForTests,
  writeCachedConversations,
  writeCachedMessages,
} from "./offline-cache.ts";
import type { ConversationListItem, DisplayItem } from "./types.ts";

describe("offline-cache", () => {
  afterEach(() => {
    setOfflineCacheBackendForTests(null);
  });

  test("resolveCacheScope normalizes habitat URL", () => {
    expect(resolveCacheScope("  WS://127.0.0.1:2658/rpc/v1  ")).toBe("ws://127.0.0.1:2658/rpc/v1");
  });

  test("resolveHabitatCacheScope prefers portalShell habitatWsUrl", () => {
    const prevWindow = globalThis.window;
    const shell = { habitatWsUrl: "ws://habitat.example/rpc/v1" };
    globalThis.window = { portalShell: shell } as Window & typeof globalThis;
    try {
      expect(resolveHabitatCacheScope()).toBe("ws://habitat.example/rpc/v1:user");
    } finally {
      globalThis.window = prevWindow;
    }
  });

  test("read/write conversations round-trip", async () => {
    setOfflineCacheBackendForTests(new Map());
    const scope = "ws://127.0.0.1:2658/rpc/v1";
    const items: ConversationListItem[] = [
      { id: "c1", title: "hello", created: "2026-01-01", platform: "chat" },
    ];
    await writeCachedConversations(scope, false, items);
    expect(await readCachedConversations(scope, false)).toEqual(items);
    expect(await readCachedConversations(scope, true)).toBeNull();
  });

  test("read/write messages round-trip", async () => {
    setOfflineCacheBackendForTests(new Map());
    const scope = "ws://127.0.0.1:2658/rpc/v1";
    const display: DisplayItem[] = [{ type: "message", role: "user", content: "hi" }];
    await writeCachedMessages(scope, "c1", display);
    expect(await readCachedMessages(scope, "c1")).toEqual(display);
  });
});
