import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  Mail,
  MessageSquare,
  Settings,
  Timer,
} from "lucide-react";

import type { ShellModuleId } from "@freeanima/client/portal-sdk/shell-module-visibility";

import { m } from "@paraglide/messages";

/** Shell Rail/底栏已有图标，去掉 Paraglide 文案前缀 emoji。 */
export function stripLeadingNavEmoji(label: string): string {
  return label
    .replace(
      /^(?:\p{RI}\p{RI}|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u,
      "",
    )
    .trim();
}

function shellNavLabel(message: () => string): () => string {
  return () => stripLeadingNavEmoji(message());
}

export type AppNavItem = {
  id: ShellModuleId;
  to: string;
  match: string;
  label: () => string;
  icon: LucideIcon;
};

function navItem(
  id: ShellModuleId,
  to: string,
  match: string,
  label: () => string,
  icon: LucideIcon,
): AppNavItem {
  return { id, to, match, label, icon };
}

/** 全部 Shell 模块（Rail / 设置页顺序） */
export function appNavItems(): AppNavItem[] {
  return [
    navItem("chat", "/chat", "/chat", shellNavLabel(m.habitat_nav_chat), MessageSquare),
    navItem("tasks", "/tasks", "/tasks", shellNavLabel(m.habitat_nav_tasks), ListTodo),
    navItem(
      "projects",
      "/projects",
      "/projects",
      shellNavLabel(m.habitat_nav_projects),
      FolderKanban,
    ),
    navItem("pomodoro", "/pomodoro", "/pomodoro", shellNavLabel(m.habitat_nav_pomodoro), Timer),
    navItem("email", "/email", "/email", shellNavLabel(m.habitat_nav_email), Mail),
    navItem("diary", "/diary", "/diary", shellNavLabel(m.habitat_nav_diary), BookOpen),
    navItem("entity", "/entity", "/entity", shellNavLabel(m.habitat_nav_entity), Boxes),
    navItem("vault", "/vault", "/vault", shellNavLabel(m.habitat_nav_vault), Lock),
    navItem(
      "notifications",
      "/notifications",
      "/notifications",
      shellNavLabel(m.habitat_nav_notifications),
      Bell,
    ),
    navItem(
      "habitat",
      "/habitat/dashboard",
      "/habitat",
      shellNavLabel(m.habitat_nav),
      LayoutDashboard,
    ),
    navItem("settings", "/settings", "/settings", shellNavLabel(m.habitat_nav_settings), Settings),
  ];
}

export function filterVisibleNavItems(
  items: AppNavItem[],
  visible: Set<ShellModuleId>,
): AppNavItem[] {
  return items.filter((item) => visible.has(item.id));
}

/** 按用户顺序排列后过滤可见模块（Rail / 底栏 / 设置页）。 */
export function orderedVisibleAppNavItems(
  visible: Set<ShellModuleId>,
  order: ShellModuleId[],
): AppNavItem[] {
  const byId = new Map(appNavItems().map((item) => [item.id, item]));
  const ordered: AppNavItem[] = [];
  const seen = new Set<ShellModuleId>();
  for (const id of order) {
    if (!visible.has(id) || seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    ordered.push(item);
  }
  for (const item of appNavItems()) {
    if (!visible.has(item.id) || seen.has(item.id)) continue;
    ordered.push(item);
  }
  return ordered;
}
