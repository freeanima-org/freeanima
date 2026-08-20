import { z } from "zod";

import { entities, entityTypeSchema, type EntitySelect } from "./entity.ts";
import {
  CALENDAR_EVENT_COMPONENT,
  CALENDAR_UI_PREFS_COMPONENT,
  CONTENT_BLOCK_COMPONENT,
  DIARY_BLOCK_TEMPLATE_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  NOTE_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_OCCURRENCE_COMPONENT,
  TASK_LIST_COMPONENT,
  SMART_LIST_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  PROJECT_COMPONENT,
  TAG_COMPONENT,
  VAULT_CONFIG_COMPONENT,
  VAULT_ITEM_COMPONENT,
  COMPANION_PROFILE_COMPONENT,
  POMODORO_CONFIG_COMPONENT,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  POMODORO_ACTIVE_COMPONENT,
  WORLD_CONFIG_COMPONENT,
  OBJECT_FILE_COMPONENT,
  OBJECT_FOLDER_COMPONENT,
  SUBAGENT_COMPONENT,
  BOOKMARK_COMPONENT,
  calendarEventBodySchema,
  calendarUiPrefsBodySchema,
  contentBlockBodySchema,
  diaryBlockTemplateBodySchema,
  diaryEntryBodySchema,
  noteBodySchema,
  emailAccountBodySchema,
  emailMessageBodySchema,
  emailThreadBodySchema,
  taskItemBodySchema,
  taskOccurrenceBodySchema,
  taskListBodySchema,
  smartListBodySchema,
  projectFolderBodySchema,
  projectBodySchema,
  tagBodySchema,
  vaultConfigBodySchema,
  vaultItemBodySchema,
  companionProfileBodySchema,
  pomodoroConfigBodySchema,
  pomodoroSessionBodySchema,
  pomodoroTaskFocusBodySchema,
  pomodoroActiveBodySchema,
  worldConfigBodySchema,
  objectFileBodySchema,
  objectFolderBodySchema,
  subagentBodySchema,
  bookmarkBodySchema,
  type CalendarEventBody,
  type CalendarUiPrefsBody,
  type ContentBlockBody,
  type DiaryBlockTemplateBody,
  type DiaryEntryBody,
  type NoteBody,
  type EmailAccountBody,
  type EmailMessageBody,
  type EmailThreadBody,
  type TaskItemBody,
  type TaskOccurrenceBody,
  type TaskListBody,
  type SmartListBody,
  type ProjectFolderBody,
  type ProjectBody,
  type TagBody,
  type VaultConfigBody,
  type VaultItemBody,
  type CompanionProfileBody,
  type PomodoroConfigBody,
  type PomodoroSessionBody,
  type PomodoroTaskFocusBody,
  type PomodoroActiveBody,
  type WorldConfigBody,
  type ObjectFileBody,
  type ObjectFolderBody,
  type SubagentBody,
  type BookmarkBody,
} from "./components/index.ts";
import { parseEntityRevisions, type EntityRevision } from "./revisions.ts";

export type EntityRow = {
  id: number;
  type: z.infer<typeof entityTypeSchema>;
  world_id: number;
  components: string[];
  /** 空壳时为 null */
  primary_component: string | null;
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  pinned: boolean;
  reference_count: number;
  tag_ids: number[];
  /** 顶层版本快照；list projection 可能为空数组 */
  revisions: EntityRevision[];
  /** 软删时间；null 表示存活 */
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * 列表 / filter_only / get 查询列（业务表已无搜索旁路列；投影保持显式）。
 */
export const entityRowSelectColumns = {
  id: entities.id,
  type: entities.type,
  world_id: entities.world_id,
  components: entities.components,
  primary_component: entities.primary_component,
  title: entities.title,
  summary: entities.summary,
  content: entities.content,
  body: entities.body,
  pinned: entities.pinned,
  reference_count: entities.reference_count,
  tag_ids: entities.tag_ids,
  revisions: entities.revisions,
  deleted_at: entities.deleted_at,
  created_at: entities.created_at,
  updated_at: entities.updated_at,
} as const;

/** 邮件/vault 等列表：不拉 content / revisions（正文与历史另走 get） */
export const entityListSelectColumns = {
  id: entities.id,
  type: entities.type,
  world_id: entities.world_id,
  components: entities.components,
  primary_component: entities.primary_component,
  title: entities.title,
  summary: entities.summary,
  body: entities.body,
  pinned: entities.pinned,
  reference_count: entities.reference_count,
  tag_ids: entities.tag_ids,
  deleted_at: entities.deleted_at,
  created_at: entities.created_at,
  updated_at: entities.updated_at,
} as const;

export type EntityRowSelect = Pick<EntitySelect, keyof typeof entityRowSelectColumns>;
export type EntityListRowSelect = Pick<EntitySelect, keyof typeof entityListSelectColumns>;

export function mapEntityRow(
  row: EntityRowSelect | (EntityListRowSelect & { content?: string; revisions?: unknown }),
): EntityRow {
  const typeParsed = entityTypeSchema.parse(row.type);
  return {
    id: row.id,
    type: typeParsed,
    world_id: row.world_id,
    components: [...row.components],
    primary_component: row.primary_component ?? null,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    body: (row.body ?? {}) as Record<string, unknown>,
    pinned: row.pinned ?? false,
    reference_count: row.reference_count ?? 0,
    tag_ids: [...(row.tag_ids ?? [])],
    revisions: parseEntityRevisions("revisions" in row ? row.revisions : []),
    deleted_at: row.deleted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function asWorld(row: EntityRow): WorldConfigBody | null {
  if (row.type !== "world" || !row.components.includes(WORLD_CONFIG_COMPONENT)) return null;
  const parsed = worldConfigBodySchema.safeParse(row.body);
  return parsed.success ? parsed.data : null;
}

export function worldAccessFromRow(row: EntityRow): WorldConfigBody | null {
  return asWorld(row);
}

export function asTaskList(row: EntityRow): (TaskListBody & { id: number; name: string }) | null {
  if (row.primary_component !== TASK_LIST_COMPONENT) return null;
  const parsed = taskListBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, name: row.title, ...parsed.data } : null;
}

export function asSmartList(
  row: EntityRow,
): (SmartListBody & { id: number; title: string }) | null {
  if (row.primary_component !== SMART_LIST_COMPONENT) return null;
  const parsed = smartListBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, title: row.title, ...parsed.data } : null;
}

export function asTaskItem(
  row: EntityRow,
): (TaskItemBody & { id: number; title: string; content: string }) | null {
  if (!row.components.includes(TASK_ITEM_COMPONENT)) return null;
  const parsed = taskItemBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asTaskOccurrence(
  row: EntityRow,
): (TaskOccurrenceBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== TASK_OCCURRENCE_COMPONENT) return null;
  const parsed = taskOccurrenceBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asDiaryEntry(
  row: EntityRow,
): (DiaryEntryBody & { id: number; title: string; content: string; summary: string }) | null {
  if (row.primary_component !== DIARY_ENTRY_COMPONENT) return null;
  const parsed = diaryEntryBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, summary: row.summary, ...parsed.data }
    : null;
}

export function asNote(
  row: EntityRow,
): (NoteBody & { id: number; title: string; content: string; summary: string }) | null {
  if (row.primary_component !== NOTE_COMPONENT) return null;
  const parsed = noteBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, summary: row.summary, ...parsed.data }
    : null;
}

export function asCalendarEvent(
  row: EntityRow,
): (CalendarEventBody & { id: number; title: string; content: string; summary: string }) | null {
  if (row.primary_component !== CALENDAR_EVENT_COMPONENT) return null;
  const parsed = calendarEventBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, summary: row.summary, ...parsed.data }
    : null;
}

export function asDiaryBlockTemplate(
  row: EntityRow,
): (DiaryBlockTemplateBody & { id: number; name: string }) | null {
  if (row.primary_component !== DIARY_BLOCK_TEMPLATE_COMPONENT) return null;
  const parsed = diaryBlockTemplateBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, name: row.title, ...parsed.data } : null;
}

export function asContentBlock(
  row: EntityRow,
): (ContentBlockBody & { id: number; title: string; content: string; summary: string }) | null {
  if (row.primary_component !== CONTENT_BLOCK_COMPONENT) return null;
  const parsed = contentBlockBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, summary: row.summary, ...parsed.data }
    : null;
}

export function asEmailAccount(
  row: EntityRow,
): (EmailAccountBody & { id: number; display_name: string }) | null {
  if (row.primary_component !== EMAIL_ACCOUNT_COMPONENT) return null;
  const parsed = emailAccountBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, display_name: row.title, ...parsed.data } : null;
}

export function asEmailThread(
  row: EntityRow,
): (EmailThreadBody & { id: number; subject: string; preview: string }) | null {
  if (row.primary_component !== EMAIL_THREAD_COMPONENT) return null;
  const parsed = emailThreadBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, subject: row.title, preview: row.summary, ...parsed.data }
    : null;
}

export function asEmailMessage(
  row: EntityRow,
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

export function asVaultConfig(row: EntityRow): (VaultConfigBody & { id: number }) | null {
  if (row.primary_component !== VAULT_CONFIG_COMPONENT) return null;
  const parsed = vaultConfigBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asVaultItem(
  row: EntityRow,
): (VaultItemBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== VAULT_ITEM_COMPONENT) return null;
  const parsed = vaultItemBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asCompanionProfile(row: EntityRow): (CompanionProfileBody & { id: number }) | null {
  if (row.primary_component !== COMPANION_PROFILE_COMPONENT) return null;
  const parsed = companionProfileBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asPomodoroConfig(row: EntityRow): (PomodoroConfigBody & { id: number }) | null {
  if (row.primary_component !== POMODORO_CONFIG_COMPONENT) return null;
  const parsed = pomodoroConfigBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asCalendarUiPrefs(row: EntityRow): (CalendarUiPrefsBody & { id: number }) | null {
  if (row.primary_component !== CALENDAR_UI_PREFS_COMPONENT) return null;
  const parsed = calendarUiPrefsBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asPomodoroSession(
  row: EntityRow,
): (PomodoroSessionBody & { id: number; title: string }) | null {
  if (row.primary_component !== POMODORO_SESSION_COMPONENT) return null;
  const parsed = pomodoroSessionBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, title: row.title, ...parsed.data } : null;
}

export function asPomodoroTaskFocus(
  row: EntityRow,
): (PomodoroTaskFocusBody & { id: number }) | null {
  if (row.primary_component !== POMODORO_TASK_FOCUS_COMPONENT) return null;
  const parsed = pomodoroTaskFocusBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asPomodoroActive(row: EntityRow): (PomodoroActiveBody & { id: number }) | null {
  if (row.primary_component !== POMODORO_ACTIVE_COMPONENT) return null;
  const parsed = pomodoroActiveBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, ...parsed.data } : null;
}

export function asProjectFolder(
  row: EntityRow,
): (ProjectFolderBody & { id: number; name: string }) | null {
  if (row.primary_component !== PROJECT_FOLDER_COMPONENT) return null;
  const parsed = projectFolderBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, name: row.title, ...parsed.data } : null;
}

export function asProject(
  row: EntityRow,
): (ProjectBody & { id: number; title: string; content: string }) | null {
  if (row.primary_component !== PROJECT_COMPONENT) return null;
  const parsed = projectBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, content: row.content, ...parsed.data }
    : null;
}

export function asObjectFile(
  row: EntityRow,
): (ObjectFileBody & { id: number; title: string; world_id: number }) | null {
  if (row.primary_component !== OBJECT_FILE_COMPONENT) return null;
  const parsed = objectFileBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, world_id: row.world_id, ...parsed.data }
    : null;
}

export function asObjectFolder(
  row: EntityRow,
): (ObjectFolderBody & { id: number; title: string; world_id: number }) | null {
  if (row.primary_component !== OBJECT_FOLDER_COMPONENT) return null;
  const parsed = objectFolderBodySchema.safeParse(row.body);
  return parsed.success
    ? { id: row.id, title: row.title, world_id: row.world_id, ...parsed.data }
    : null;
}

export function asTag(row: EntityRow): (TagBody & { id: number; title: string }) | null {
  if (row.primary_component !== TAG_COMPONENT) return null;
  const parsed = tagBodySchema.safeParse(row.body);
  return parsed.success ? { id: row.id, title: row.title, ...parsed.data } : null;
}

export function asBookmark(row: EntityRow):
  | (BookmarkBody & {
      id: number;
      title: string;
      content: string;
      deleted_at: Date | null;
      created_at: Date;
      updated_at: Date;
    })
  | null {
  if (row.primary_component !== BOOKMARK_COMPONENT) return null;
  const parsed = bookmarkBodySchema.safeParse(row.body);
  return parsed.success
    ? {
        id: row.id,
        title: row.title,
        content: row.content,
        deleted_at: row.deleted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        ...parsed.data,
      }
    : null;
}

export function asSubagent(row: EntityRow):
  | (SubagentBody & {
      id: number;
      title: string;
      summary: string;
      content: string;
      world_id: number;
    })
  | null {
  if (row.primary_component !== SUBAGENT_COMPONENT) return null;
  const parsed = subagentBodySchema.safeParse(row.body);
  return parsed.success
    ? {
        id: row.id,
        title: row.title,
        summary: row.summary,
        content: row.content,
        world_id: row.world_id,
        ...parsed.data,
      }
    : null;
}
