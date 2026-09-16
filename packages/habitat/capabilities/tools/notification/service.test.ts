import { describe, expect, it, mock } from "bun:test";
import { Context } from "cordis";
import { createHookContext, runBeforeLlmCall } from "@freeanima/habitat/core/hooks/cordis";
import type { NotificationRow } from "@freeanima/habitat/core/db/schema/rows";
import type { NotificationPort } from "./port.ts";
import { NotificationService } from "./service.ts";

const listMock = mock(async (): Promise<NotificationRow[]> => []);
const getConversationMetaMock = mock(async (): Promise<unknown> => ({
  model: "m",
  agent_subject_id: 42,
  scenario: "chat",
}));

const conversationOriginal = await import("@freeanima/habitat/core/db/pg/conversation");

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  ...conversationOriginal,
  getConversationMeta: getConversationMetaMock,
}));

const { notificationInjectPlugin } = await import("./inject-plugin.ts");

function fakePort(): NotificationPort {
  return {
    list: listMock,
    create: async () => {
      throw new Error("create not used");
    },
    markRead: async () => null,
    markReadBySourceRef: async () => 0,
    existsBySourceRef: async () => false,
    getAgentRecipient: () => ({ kind: "agent", id: 1 }),
    getUserRecipient: () => ({ kind: "user", id: 1 }),
  };
}

const tick = async (): Promise<void> => {
  await new Promise<void>((r) => {
    setTimeout(r, 0);
  });
};

describe("NotificationService (Cordis service seam)", () => {
  it("registers a typed ctx.notifications", async () => {
    const ctx = createHookContext();
    const port = fakePort();
    await ctx.plugin(NotificationService, { port });
    expect(ctx.notifications.port).toBe(port);
  });

  it("defers inject activation until the service is provided", async () => {
    const ctx = createHookContext();
    const captured: { port: NotificationPort | null } = { port: null };
    ctx.plugin((inner) => {
      inner.inject(["notifications"], (scope) => {
        captured.port = scope.notifications.port;
      });
    });
    await tick();
    expect(captured.port).toBeNull();

    const port = fakePort();
    await ctx.plugin(NotificationService, { port });
    await tick();
    expect(captured.port).toBe(port);
  });

  it("removes ctx.notifications when the owning fiber disposes", async () => {
    const ctx = createHookContext();
    const fiber = ctx.plugin(NotificationService, { port: fakePort() });
    await fiber;
    expect(ctx.notifications).toBeDefined();
    await fiber.dispose();
    expect(ctx.notifications).toBeUndefined();
  });

  it("mounts the inject hook once the service is ready", async () => {
    const ctx = createHookContext();
    listMock.mockClear();
    await ctx.plugin(NotificationService, { port: fakePort() });
    ctx.plugin(notificationInjectPlugin);
    await tick();

    await runBeforeLlmCall(ctx, {
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

  it("stays dormant when the service is never provided", async () => {
    const ctx = new Context();
    listMock.mockClear();
    ctx.plugin(notificationInjectPlugin);
    await tick();
    await runBeforeLlmCall(ctx, {
      conversationId: "c-1",
      messages: [{ role: "user", content: "hi" }],
    } as never);
    expect(listMock).not.toHaveBeenCalled();
  });
});
