import { describe, expect, it } from "bun:test";
import type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRow,
  NotificationStorePort,
} from "@freeanima/core/repos";
import { DEFAULT_NOTIFICATION_RECIPIENT_ID } from "@freeanima/core/repos";
import type { RuntimeDeps } from "./runtime-deps.ts";
import {
  createNotification,
  createNotificationForRecipients,
  listNotifications,
  markNotificationRead,
} from "./service-notifications.ts";

function createMemoryNotificationStore(): NotificationStorePort {
  const rows = new Map<string, NotificationRow>();

  return {
    async create(input: NotificationCreateInput): Promise<NotificationRow> {
      const row: NotificationRow = {
        id: `n-${rows.size + 1}`,
        recipient_kind: input.recipient_kind,
        recipient_id: input.recipient_id?.trim() || DEFAULT_NOTIFICATION_RECIPIENT_ID,
        title: input.title,
        body: input.body,
        payload: input.payload ?? null,
        read_at: null,
        created_at: new Date().toISOString(),
        source_kind: input.source_kind ?? null,
        source_ref: input.source_ref ?? null,
      };
      rows.set(row.id, row);
      return row;
    },
    async list(opts: NotificationListOpts): Promise<NotificationRow[]> {
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
    async count(opts: Omit<NotificationListOpts, "offset" | "limit">): Promise<number> {
      const recipientId = opts.recipient_id?.trim() || DEFAULT_NOTIFICATION_RECIPIENT_ID;
      let items = [...rows.values()].filter(
        (row) => row.recipient_kind === opts.recipient_kind && row.recipient_id === recipientId,
      );
      if (opts.read_filter === "unread") {
        items = items.filter((row) => row.read_at == null);
      }
      return items.length;
    },
    async markRead(id: string): Promise<NotificationRow | null> {
      const row = rows.get(id.trim());
      if (!row) return null;
      if (row.read_at != null) return row;
      const updated = { ...row, read_at: new Date().toISOString() };
      rows.set(row.id, updated);
      return updated;
    },
  };
}

function testDeps(store: NotificationStorePort): RuntimeDeps {
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: {
      repos: {
        notifications: store,
      },
    } as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describe("service-notifications", () => {
  it("lists unread notifications for recipient", async () => {
    const store = createMemoryNotificationStore();
    const deps = testDeps(store);
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

    const userUnread = await listNotifications(deps, {
      recipient_kind: "user",
      read_filter: "unread",
    });
    expect(userUnread.total).toBe(1);
  });

  it("marks notification read", async () => {
    const store = createMemoryNotificationStore();
    const deps = testDeps(store);
    const created = await createNotification(deps, {
      recipient_kind: "user",
      title: "A",
      body: "one",
    });
    const marked = await markNotificationRead(deps, created.id);
    expect(marked?.read_at).not.toBeNull();

    const unread = await listNotifications(deps, {
      recipient_kind: "user",
      read_filter: "unread",
    });
    expect(unread.total).toBe(0);
  });

  it("fan-out creates one row per recipient kind", async () => {
    const store = createMemoryNotificationStore();
    const deps = testDeps(store);
    const rows = await createNotificationForRecipients(
      deps,
      { title: "both", body: "hello" },
      ["user", "agent"],
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.recipient_kind).sort()).toEqual(["agent", "user"]);
  });
});
