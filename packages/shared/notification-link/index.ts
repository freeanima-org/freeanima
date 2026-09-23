/**
 * 通知跳转目标（模块 / 容器 / 实体）——SSOT。
 *
 * 存储位置：`notifications.payload.link`（jsonb，无需迁移）；RPC 面提升为行上的 `link` 字段。
 * 解析/构造保持纯函数（无 Node / React / PG 依赖），服务端写入与三端 UI 共用。
 */
import { z } from "zod";

import {
  animaUriToShellPath,
  defaultPresentForComponent,
  parseAnimaUri,
  type AnimaPresent,
} from "@freeanima/shared/anima-uri";

export const NOTIFICATION_LINK_CONTAINER_MODULES = ["tasks", "project", "email"] as const;
export type NotificationLinkContainerModule = (typeof NOTIFICATION_LINK_CONTAINER_MODULES)[number];

export const notificationLinkContainerSchema = z.object({
  module: z.enum(NOTIFICATION_LINK_CONTAINER_MODULES),
  /** tasks：清单 id */
  list_id: z.number().int().positive().optional(),
  /** tasks：智能清单 key */
  smart_list_key: z.string().min(1).optional(),
  /** project：项目 id */
  project_id: z.number().int().positive().optional(),
  /** email：账户 id */
  account_id: z.number().int().positive().optional(),
  /** email：邮件 id */
  message_id: z.number().int().positive().optional(),
});

export type NotificationLinkContainer = z.infer<typeof notificationLinkContainerSchema>;

export const notificationLinkEntitySchema = z.object({
  id: z.number().int().positive(),
  component: z.string().min(1).optional(),
  present: z.enum(["overlay", "navigate"]).optional(),
});

export type NotificationLinkEntity = z.infer<typeof notificationLinkEntitySchema>;

export const notificationLinkSchema = z.object({
  /** 模块 shell 路径（含 query），如 `/tasks?list=3`、`/calendar?event=9` */
  path: z.string().min(1).optional(),
  /** 模块内容器选型：先写 module-selection，再导航 */
  container: notificationLinkContainerSchema.optional(),
  /** 实体锚点：浮层或模块页打开 */
  entity: notificationLinkEntitySchema.optional(),
});

export type NotificationLink = z.infer<typeof notificationLinkSchema>;

/**
 * 这些组件的「模块 + 容器/实体」都在 URL query 上（`/tasks?list=`、`/projects?project=`、
 * `/email?account=`、`/note?id=`、`/diary?id=`），导航即定位，不再叠实体浮层。
 */
const MODULE_PATH_COMPONENTS: ReadonlySet<string> = new Set([
  "task_list",
  "project",
  "note",
  "diary_entry",
  "email_account",
]);

function positiveIntOrNull(raw: number | null | undefined): number | null {
  return raw != null && Number.isInteger(raw) && raw > 0 ? raw : null;
}

/** 边界解析：非法/缺字段一律 `null`（绝不抛），调用方退化为「无跳转目标」。 */
export function parseNotificationLink(raw: unknown): NotificationLink | null {
  if (raw == null || typeof raw !== "object") return null;
  const parsed = notificationLinkSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function shellPathNotificationLink(path: string): NotificationLink {
  const trimmed = path.trim();
  return { path: trimmed.startsWith("/") ? trimmed : `/${trimmed}` };
}

export function calendarEventNotificationLink(eventId: number): NotificationLink {
  return {
    path: "/calendar",
    entity: { id: eventId, component: "calendar_event", present: "overlay" },
  };
}

export function habitNotificationLink(habitId: number): NotificationLink {
  return {
    path: "/habits",
    entity: { id: habitId, component: "habit", present: "overlay" },
  };
}

export function emailNotificationLink(input: {
  accountId: number;
  messageId?: number | null;
}): NotificationLink {
  const messageId = positiveIntOrNull(input.messageId);
  return {
    path: `/email?account=${input.accountId}`,
    container: {
      module: "email",
      account_id: input.accountId,
      ...(messageId != null ? { message_id: messageId } : {}),
    },
  };
}

/**
 * 任务条目：清单侧带 `list`（模块页按 URL 切清单）；项目侧带 `project` + module-selection。
 * 实体统一走 `task_item` 浮层（shell 级常驻，任何模块页上都能打开）。
 */
export function taskItemNotificationLink(input: {
  id: number;
  listId?: number | null;
  projectId?: number | null;
}): NotificationLink {
  const listId = positiveIntOrNull(input.listId);
  const projectId = positiveIntOrNull(input.projectId);
  const entity: NotificationLinkEntity = {
    id: input.id,
    component: "task_item",
    present: "overlay",
  };
  if (projectId != null) {
    return {
      path: `/projects?project=${projectId}`,
      container: { module: "project", project_id: projectId },
      entity,
    };
  }
  if (listId != null) {
    return {
      path: `/tasks?list=${listId}`,
      container: { module: "tasks", list_id: listId },
      entity,
    };
  }
  return { path: "/tasks", entity };
}

/** 供 agent 工具输入用：anima URI 或 shell path。 */
export function notificationLinkFromInput(raw: string): NotificationLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return shellPathNotificationLink(trimmed);
  if (trimmed.startsWith("#/")) return shellPathNotificationLink(trimmed.slice(1));

  const parsed = parseAnimaUri(trimmed);
  if (!parsed.ok) return null;
  const ref = parsed.ref;
  const present: AnimaPresent = ref.present ?? defaultPresentForComponent(ref.component);
  const entity: NotificationLinkEntity = {
    id: ref.id,
    ...(ref.component ? { component: ref.component } : {}),
    present,
  };

  // 容器/实体即 URL 的组件：模块页自身带 query 定位，直接给 path（勿再叠浮层）。
  if (ref.component && MODULE_PATH_COMPONENTS.has(ref.component)) {
    const path = animaUriToShellPath({ ...ref, present: "navigate" });
    if (path) return { path };
  }

  // 浮层态：导航到模块根路径，再由浮层打开实体。
  const fullPath = ref.component ? animaUriToShellPath({ ...ref, present: "navigate" }) : null;
  const basePath = fullPath?.split("?")[0];
  return {
    ...(basePath ? { path: basePath } : {}),
    entity,
  };
}

/** aria-label / tooltip 用的人类可读描述。 */
export function describeNotificationLink(link: NotificationLink): string {
  const parts: string[] = [];
  if (link.path) parts.push(link.path);
  if (link.container) parts.push(`容器 ${link.container.module}`);
  if (link.entity) {
    const component = link.entity.component ? `${link.entity.component}:` : "";
    parts.push(`${component}${link.entity.id}`);
  }
  return parts.length > 0 ? parts.join(" → ") : "无跳转目标";
}
