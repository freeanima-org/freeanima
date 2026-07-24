import { describe, expect, it, mock, beforeEach } from "bun:test";
import type {
  NotificationCreateInput,
  NotificationListOpts,
} from "@freeanima/host/core/db/pg/notifications/types";
import type { NotificationRow } from "@freeanima/host/core/db/schema/rows";
import { DEFAULT_NOTIFICATION_RECIPIENT_ID } from "@freeanima/host/core/db/pg/notifications/types";
import type { RuntimeDeps } from "./runtime-deps.ts";

const rows = new Map<string, NotificationRow>();

const createPgNotificationMock = mock(
  async (input: NotificationCreateInput): Promise<NotificationRow> => {
    const row: NotificationRow = {
      id: `n-${rows.size + 1}`,
      recipient_kind: input.recipient_kind,
      recipient_id: input.recipient_id?.trim() || DEFAULT_NOTIFICATION_RECIPIENT_ID,
      title: input.title,
      body: input.body,
      payload: input.payload ?? null,
      read_at: null,
      created_at: new Date(),
      source_kind: input.source_kind ?? null,
      source_ref: input.source_ref ?? null,
    };
    rows.set(row.id, row);
    return row;
  },
);

const listPgNotificationsMock = mock(
  async (opts: NotificationListOpts): Promise<NotificationRow[]> => {
    const recipientId = opts.recipient_id?.trim() || DEFAULT_NOTIFICATION_RECIPIENT_ID;
    let items = [...rows.values()].filter(
      (row) => row.recipient_kind === opts.recipient_kind && row.recipient_id === recipientId,
    );
    if (opts.read_filter === "unread") {
      items = items.filter((row) => row.read_at == null);
    }
    const offset = Math.max(0, opts.offset ?? 0);
    const limit = Math.max(1, Math.min(100, opts.limit ?? 20));
    return items.slice(offset, offset + limit);
  },
);

const countNotificationsMock = mock(
  async (opts: Omit<NotificationListOpts, "offset" | "limit">): Promise<number> => {
    const recipientId = opts.recipient_id?.trim() || DEFAULT_NOTIFICATION_RECIPIENT_ID;
    let items = [...rows.values()].filter(
      (row) => row.recipient_kind === opts.recipient_kind && row.recipient_id === recipientId,
    );
    if (opts.read_filter === "unread") {
      items = items.filter((row) => row.read_at == null);
    }
    return items.length;
  },
);

const markPgNotificationReadMock = mock(async (id: string): Promise<NotificationRow | null> => {
  const row = rows.get(id.trim());
  if (!row) return null;
  if (row.read_at != null) return row;
  const updated = { ...row, read_at: new Date() };
  rows.set(row.id, updated);
  return updated;
});

mock.module("@freeanima/host/core/db/pg/notifications", () => ({
  createNotification: createPgNotificationMock,
  listNotifications: listPgNotificationsMock,
  countNotifications: countNotificationsMock,
  markNotificationRead: markPgNotificationReadMock,
}));

import { createNotification, listNotifications, markNotificationRead } from "./service.ts";

function testDeps(): RuntimeDeps {
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: {} as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describe("service-notifications", () => {
  beforeEach(() => {
    rows.clear();
    createPgNotificationMock.mockClear();
    listPgNotificationsMock.mockClear();
    countNotificationsMock.mockClear();
    markPgNotificationReadMock.mockClear();
  });

  it("lists unread notifications for recipient", async () => {
    const deps = testDeps();
    await createNotification(deps, {
      recipient_kind: "user",
      title: "A",
      body: "one",
    });
    await createNotification(deps, {
      recipient_kind: "agent",
      title: "B",
      body: "two",
    });

    const userAll = await listNotifications(deps, { recipient_kind: "user" });
    expect(userAll.total).toBe(1);
    expect(userAll.items[0]?.title).toBe("A");

    const agentUnread = await listNotifications(deps, {
      recipient_kind: "agent",
      read_filter: "unread",
    });
    expect(agentUnread.total).toBe(1);
  });

  it("marks notification read", async () => {
    const deps = testDeps();
    const created = await createNotification(deps, {
      recipient_kind: "user",
      title: "Read me",
      body: "body",
    });

    const marked = await markNotificationRead(deps, created.id);
    expect(marked?.read_at).not.toBeNull();

    const unread = await listNotifications(deps, {
      recipient_kind: "user",
      read_filter: "unread",
    });
    expect(unread.total).toBe(0);
  });

  it("createNotification can fan out to user and agent", async () => {
    const deps = testDeps();
    await createNotification(deps, { recipient_kind: "user", title: "Fanout", body: "both" });
    await createNotification(deps, { recipient_kind: "agent", title: "Fanout", body: "both" });
    const userRows = await listNotifications(deps, { recipient_kind: "user" });
    const agentRows = await listNotifications(deps, { recipient_kind: "agent" });
    expect(userRows.items).toHaveLength(1);
    expect(agentRows.items).toHaveLength(1);
    expect(userRows.items[0]?.title).toBe("Fanout");
    expect(agentRows.items[0]?.title).toBe("Fanout");
  });
});
