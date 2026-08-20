import { describe, expect, it } from "bun:test";
import {
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
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    });
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
