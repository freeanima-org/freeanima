import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  LayoutDashboard,
  ListTodo,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  Settings,
} from "lucide-react";

import type { ShellModuleId } from "@freeanima/shell-sdk/shell-module-visibility";

import * as m from "../../../../../messages/paraglide/messages.js";

export type ShellNavItem = {
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
): ShellNavItem {
  return { id, to, match, label, icon };
}

/** 全部 Shell 模块（Rail / 设置页顺序） */
export function shellNavItems(): ShellNavItem[] {
  return [
    navItem("chat", "/chat", "/chat", () => m.console_nav_chat(), MessageSquare),
    navItem("tasks", "/tasks", "/tasks", () => m.console_nav_tasks(), ListTodo),
    navItem("email", "/email", "/email", () => m.console_nav_email(), Mail),
    navItem("diary", "/diary", "/diary", () => m.console_nav_diary(), BookOpen),
    navItem("vault", "/vault", "/vault", () => m.console_nav_vault(), Lock),
    navItem("dream", "/dream", "/dream", () => m.console_nav_dream(), Moon),
    navItem(
      "notifications",
      "/notifications",
      "/notifications",
      () => m.console_nav_notifications(),
      Bell,
    ),
    navItem(
      "console",
      "/console/dashboard",
      "/console",
      () => m.console_nav_dashboard(),
      LayoutDashboard,
    ),
    navItem("settings", "/settings", "/settings", () => m.console_nav_settings(), Settings),
  ];
}

/** 移动端底栏 — 核心模块（console/settings 经 More） */
export function shellMobilePrimaryNavItems(): ShellNavItem[] {
  return shellNavItems().filter((item) =>
    ["chat", "tasks", "email", "diary", "dream", "notifications"].includes(item.id),
  );
}

/** 移动端 More — 次要模块 */
export function shellMobileMoreNavItems(): ShellNavItem[] {
  return shellNavItems().filter((item) => ["vault", "console", "settings"].includes(item.id));
}

export function filterVisibleNavItems(
  items: ShellNavItem[],
  visible: Set<ShellModuleId>,
): ShellNavItem[] {
  return items.filter((item) => visible.has(item.id));
}
