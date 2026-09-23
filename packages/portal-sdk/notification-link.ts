/**
 * 通知跳转目标解析（模块 / 容器 / 实体）。
 *
 * 顺序固定：先写模块内容器选型（module-selection，保证「已在模块内」也能切换），
 * 再导航模块路径（`present=navigate` 或 URL 自带 query），最后按需打开实体浮层。
 * 跳转**不**改已读状态（点击 ≠ 收件箱确认）。
 */
import type {
  NotificationLink,
  NotificationLinkContainer,
} from "@freeanima/shared/notification-link";

import { writeModuleSelection } from "./module-selection.ts";
import { openEntityResource } from "./open-entity-resource.ts";
import { navigateAppModulePath } from "./pomodoro-launch.ts";

export type OpenNotificationLinkResult =
  | { ok: true; mode: "navigate" | "overlay" }
  | { ok: false; error: string };

/** 把 link.container 落到模块选型（持久化，供模块下次进入 / 已在模块内时读取）。 */
export function applyNotificationLinkContainer(container: NotificationLinkContainer): void {
  switch (container.module) {
    case "tasks": {
      if (container.list_id != null) {
        writeModuleSelection("tasks", { kind: "list", id: container.list_id });
        return;
      }
      const key = container.smart_list_key?.trim();
      if (key) writeModuleSelection("tasks", { kind: "smart_list", key });
      return;
    }
    case "project": {
      if (container.project_id != null) {
        writeModuleSelection("project", container.project_id);
      }
      return;
    }
    case "email": {
      if (container.account_id != null) {
        writeModuleSelection("email", {
          accountId: container.account_id,
          messageId: container.message_id ?? null,
        });
      }
      return;
    }
    default:
      return;
  }
}

/** 执行通知跳转；失败返回可展示的中文错误（不抛）。 */
export async function openNotificationLink(
  link: NotificationLink,
): Promise<OpenNotificationLinkResult> {
  if (link.container) applyNotificationLinkContainer(link.container);

  const path = link.path?.trim();
  if (path) navigateAppModulePath(path);

  if (link.entity) {
    const result = await openEntityResource({
      id: link.entity.id,
      ...(link.entity.component ? { component: link.entity.component } : {}),
      ...(link.entity.present ? { present: link.entity.present } : {}),
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, mode: result.mode };
  }

  if (!path) return { ok: false, error: "通知缺少跳转目标" };
  return { ok: true, mode: "navigate" };
}
