import { afterEach, describe, expect, it } from "bun:test";

import {
  claimChatSend,
  createEphemeralChatSend,
  enqueueChatSend,
  isChatSendClaimed,
  listChatOutboxEntries,
  releaseChatSend,
  resetChatSendClaimsForTests,
} from "./offline-send-store.ts";
import { setOfflineOutboxBackendForTests } from "@freeanima/frontend/portal-sdk/offline-outbox";

describe("chat send claim", () => {
  afterEach(() => {
    resetChatSendClaimsForTests();
  });

  it("refcount：嵌套 claim 在全部 release 后才清除", () => {
    claimChatSend("op-1");
    claimChatSend("op-1");
    expect(isChatSendClaimed("op-1")).toBe(true);
    releaseChatSend("op-1");
    expect(isChatSendClaimed("op-1")).toBe(true);
    releaseChatSend("op-1");
    expect(isChatSendClaimed("op-1")).toBe(false);
  });

  it("release 多余次数不会变成负数 claim", () => {
    releaseChatSend("op-x");
    expect(isChatSendClaimed("op-x")).toBe(false);
    claimChatSend("op-x");
    releaseChatSend("op-x");
    releaseChatSend("op-x");
    expect(isChatSendClaimed("op-x")).toBe(false);
  });
});

describe("createEphemeralChatSend", () => {
  afterEach(() => {
    setOfflineOutboxBackendForTests(null);
  });

  it("在线 ephemeral 不写 IDB；enqueue 才持久化", async () => {
    const map = new Map<string, unknown>();
    setOfflineOutboxBackendForTests(map);

    const ephemeral = createEphemeralChatSend("conv-1", "hello", 3);
    expect(ephemeral.persisted).toBe(false);
    expect(await listChatOutboxEntries("test-scope")).toEqual([]);

    const persisted = await enqueueChatSend("conv-1", "hello", 3, {
      clientOpId: ephemeral.clientOpId,
      scope: "test-scope",
    });
    expect(persisted.persisted).toBe(true);
    const listed = await listChatOutboxEntries("test-scope");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.clientOpId).toBe(ephemeral.clientOpId);
  });
});
