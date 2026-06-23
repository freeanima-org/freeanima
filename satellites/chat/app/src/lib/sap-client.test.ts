import { describe, expect, test } from "bun:test";

import { memorySapInstanceStore, type SapInstanceStore } from "@freeanima/sap-contract";

import { resetChatInstanceCacheForTests } from "./sap-client.ts";

function formatPlatformFromStore(store: SapInstanceStore): string {
  const id = store.load();
  if (!id) throw new Error("instance_id is required");
  return `sap:chat:${id}`;
}

describe("chatPlatform store", () => {
  test("有 instance_id 时返回 sap:chat:{id}", () => {
    resetChatInstanceCacheForTests();
    const store = memorySapInstanceStore("tou");
    expect(formatPlatformFromStore(store)).toBe("sap:chat:tou");
  });

  test("无 instance_id 时抛出", () => {
    const store = memorySapInstanceStore(null);
    expect(() => formatPlatformFromStore(store)).toThrow("instance_id is required");
  });
});
