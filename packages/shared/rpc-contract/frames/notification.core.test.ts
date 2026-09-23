import { describe, expect, it } from "bun:test";
import {
  notificationCreatedEventSchema,
  notificationListInputSchema,
  notificationListOutputSchema,
  notificationMarkReadOutputSchema,
} from "./notification.ts";

describe("notification SAP frames", () => {
  it("validates list input and output", () => {
    notificationListInputSchema.parse({
      recipient_kind: "user",
      read_filter: "unread",
      offset: 0,
      limit: 20,
    });
    const output = notificationListOutputSchema.parse({
      items: [
        {
          id: "n-1",
          recipient_kind: "user",
          recipient_id: 1,
          title: "hello",
          body: "world",
          payload: null,
          read_at: null,
          created_at: "2026-06-26T00:00:00.000Z",
          source_kind: "system",
          source_ref: null,
          link: null,
        },
        {
          id: "n-2",
          recipient_kind: "user",
          recipient_id: 1,
          title: "task due",
          body: "body",
          payload: { task_item_id: 7, link: { path: "/tasks?list=3" } },
          read_at: null,
          created_at: "2026-06-26T00:00:00.000Z",
          source_kind: "system",
          source_ref: "task:7",
          link: {
            path: "/tasks?list=3",
            container: { module: "tasks", list_id: 3 },
            entity: { id: 7, component: "task_item", present: "overlay" },
          },
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    });
    expect(output.items[1]?.link?.container?.module).toBe("tasks");
  });

  it("rejects malformed link", () => {
    expect(() =>
      notificationListOutputSchema.parse({
        items: [
          {
            id: "n-1",
            recipient_kind: "user",
            recipient_id: 1,
            title: "hello",
            body: "world",
            payload: null,
            read_at: null,
            created_at: "2026-06-26T00:00:00.000Z",
            source_kind: "system",
            source_ref: null,
            link: { entity: { id: 0 } },
          },
        ],
        total: 1,
        offset: 0,
        limit: 20,
      }),
    ).toThrow();
  });

  it("created event carries optional link", () => {
    const withoutLink = notificationCreatedEventSchema.parse({
      id: "n-1",
      title: "t",
      body: "b",
      created_at: "2026-06-26T00:00:00.000Z",
    });
    expect(withoutLink.link).toBeUndefined();
    const withLink = notificationCreatedEventSchema.parse({
      id: "n-2",
      title: "t",
      body: "b",
      created_at: "2026-06-26T00:00:00.000Z",
      link: { path: "/calendar", entity: { id: 9, component: "calendar_event" } },
    });
    expect(withLink.link?.entity?.id).toBe(9);
  });

  it("validates mark-read output", () => {
    const parsed = notificationMarkReadOutputSchema.parse({
      ok: true,
      notification: {
        id: "n-1",
        recipient_kind: "agent",
        recipient_id: 2,
        title: "t",
        body: "b",
        payload: null,
        read_at: "2026-06-26T01:00:00.000Z",
        created_at: "2026-06-26T00:00:00.000Z",
        source_kind: null,
        source_ref: null,
      },
    });
    expect(parsed.ok).toBe(true);
  });
});
