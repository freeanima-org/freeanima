import { afterEach, describe, expect, it } from "bun:test";

import {
  claimChatSend,
  isChatSendClaimed,
  releaseChatSend,
  resetChatSendClaimsForTests,
} from "./offline-send-store.ts";

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
