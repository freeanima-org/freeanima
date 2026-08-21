import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { NotificationRow } from "@freeanima/habitat/core/db/schema/rows";
import { registerNotificationPort, resetNotificationPortForTests } from "./port.ts";

const listMock = mock(async (): Promise<NotificationRow[]> => []);
const getConversationMetaMock = mock(async (): Promise<unknown> => null);

const conversationOriginal = await import("@freeanima/habitat/core/db/pg/conversation");

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  ...conversationOriginal,
  getConversationMeta: getConversationMetaMock,
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/conversation", () => conversationOriginal);
});

const { createNotificationInjectHandler } = await import("./handler.ts");

describe("notification inject binds conversation agent", () => {
  beforeEach(() => {
    listMock.mockClear();
    getConversationMetaMock.mockClear();
    resetNotificationPortForTests();
    registerNotificationPort({
      list: listMock,
      create: async () => {
        throw new Error("create not used");
      },
      markRead: async () => null,
      markReadBySourceRef: async () => 0,
      existsBySourceRef: async () => false,
      getAgentRecipient: () => ({ kind: "agent", id: 1 }),
      getUserRecipient: () => ({ kind: "user", id: 1 }),
    });
  });

  afterEach(() => {
    resetNotificationPortForTests();
  });

  it("lists unread for session agent_subject_id", async () => {
    getConversationMetaMock.mockImplementation(async () => ({
      model: "m",
      agent_subject_id: 42,
      scenario: "chat",
    }));
    listMock.mockImplementation(async () => []);
    const handler = createNotificationInjectHandler();
    await handler({
      conversationId: "c-1",
      messages: [{ role: "user", content: "hi" }],
    } as never);
    expect(listMock).toHaveBeenCalledWith({
      recipient_kind: "agent",
      recipient_id: 42,
      read_filter: "unread",
      limit: expect.any(Number),
    });
  });

  it("skips when conversation has no agent_subject_id", async () => {
    getConversationMetaMock.mockImplementation(async () => ({
      model: "m",
      scenario: "chat",
    }));
    const handler = createNotificationInjectHandler();
    await handler({
      conversationId: "c-1",
      messages: [{ role: "user", content: "hi" }],
    } as never);
    expect(listMock).not.toHaveBeenCalled();
  });
});
