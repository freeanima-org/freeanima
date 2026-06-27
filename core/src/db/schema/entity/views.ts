import { z } from "zod";

import { entityTypeSchema, type EntitySelect } from "./entity.ts";
import {
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  WORLD_CONFIG_COMPONENT,
  emailAccountBodySchema,
  emailMessageBodySchema,
  emailThreadBodySchema,
  taskItemBodySchema,
  taskListBodySchema,
  worldConfigBodySchema,
  type EmailAccountBody,
  type EmailMessageBody,
  type EmailThreadBody,
  type TaskItemBody,
  type TaskListBody,
  type WorldConfigBody,
} from "./components/index.ts";

export type EntityRowView = {
  id: number;
  type: z.infer<typeof entityTypeSchema>;
  world_id: number;
  components: string[];
  primary_component: string;
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function mapEntityRow(row: EntitySelect): EntityRowView {
  const typeParsed = entityTypeSchema.parse(row.type);
  return {
    id: row.id,
    type: typeParsed,
    world_id: row.worldId,
    components: [...row.components],
    primary_component: row.primaryComponent,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    body: (row.body ?? {}) as Record<string, unknown>,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function asWorld(row: EntityRowView): WorldConfigBody | null {
  if (row.type !== "world" || !row.components.includes(WORLD_CONFIG_COMPONENT)) return null;
  const parsed = worldConfigBodySchema.safeParse(row.body);
  return parsed.success ? parsed.data : null;
}

export function worldAccessFromRow(row: EntityRowView): WorldConfigBody | null {
  return asWorld(row);
}

export function asTaskList(
  row: EntityRowView,
): (TaskListBody & { id: number; name: string }) | null {
  if (row.primary_component !== TASK_LIST_COMPONENT) return null;
  const parsed = taskListBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, name: row.title, ...parsed.data } : null;
}

export function asTaskItem(
  row: EntityRowView,
): (TaskItemBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== TASK_ITEM_COMPONENT) return null;
  const parsed = taskItemBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asEmailAccount(
  row: EntityRowView,
): (EmailAccountBody & { id: number; display_name: string }) | null {
  if (row.primary_component !== EMAIL_ACCOUNT_COMPONENT) return null;
  const parsed = emailAccountBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, display_name: row.title, ...parsed.data } : null;
}

export function asEmailThread(
  row: EntityRowView,
): (EmailThreadBody & { id: number; subject: string; preview: string }) | null {
  if (row.primary_component !== EMAIL_THREAD_COMPONENT) return null;
  const parsed = emailThreadBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, subject: row.title, preview: row.summary, ...parsed.data }
    : null;
}

export function asEmailMessage(
  row: EntityRowView,
): (EmailMessageBody & { id: number; subject: string; preview: string; body: string }) | null {
  if (row.primary_component !== EMAIL_MESSAGE_COMPONENT) return null;
  const parsed = emailMessageBodySchema.safeParse(row.body);
  return parsed.success
    ? {
        id: row.id,
        subject: row.title,
        preview: row.summary,
        body: row.content,
        ...parsed.data,
      }
    : null;
}
