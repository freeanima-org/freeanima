import { defineToolReturn, z, type ToolReturnContractFields } from "@freeanima/core/tool";

const notificationSendReturnSchema = z.object({
  ok: z.literal(true),
  notifications: z.array(
    z.object({
      id: z.string(),
      recipient_kind: z.enum(["user", "agent"]),
      recipient_id: z.string(),
    }),
  ),
});

const notificationListReturnSchema = z.object({
  ok: z.literal(true),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
      read_at: z.string().nullable(),
      created_at: z.string(),
      source_kind: z.string().nullable(),
      source_ref: z.string().nullable(),
    }),
  ),
});

const notificationMarkReadReturnSchema = z.object({
  ok: z.literal(true),
  marked: z.array(
    z.object({
      id: z.string(),
      read_at: z.string().nullable(),
    }),
  ),
  failed: z.array(
    z.object({
      id: z.string(),
      error: z.string(),
    }),
  ),
});

export const NOTIFICATION_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  notification_send: defineToolReturn({
    schema: notificationSendReturnSchema,
    example: {
      ok: true,
      notifications: [{ id: "n-1", recipient_kind: "agent", recipient_id: "1" }],
    },
  }),
  notification_list: defineToolReturn({
    schema: notificationListReturnSchema,
    example: {
      ok: true,
      items: [
        {
          id: "n-1",
          title: "任务到期",
          body: "整理收件箱",
          read_at: null,
          created_at: "2026-06-28T08:00:00.000Z",
          source_kind: "system",
          source_ref: "task_item:42:trigger:2026-06-28T09:00:00.000Z",
        },
      ],
    },
  }),
  notification_mark_read: defineToolReturn({
    schema: notificationMarkReadReturnSchema,
    example: {
      ok: true,
      marked: [{ id: "n-1", read_at: "2026-06-28T09:00:00.000Z" }],
      failed: [],
    },
  }),
};
