import type { ComponentType, SVGProps } from "react";
import {
  Bell,
  BookOpen,
  Bookmark,
  Boxes,
  CalendarDays,
  Eye,
  FolderKanban,
  HeartPulse,
  Target,
  LayoutDashboard,
  ListTodo,
  Lock,
  Mail,
  MessageSquare,
  Settings,
  StickyNote,
  Timer,
  ContactRound,
  Users,
} from "lucide-react";

import type { ShellModuleId } from "@freeanima/client/portal-sdk/shell-module-visibility";

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

type AppNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AppNavItem = {
  id: ShellModuleId;
  to: string;
  match: string;
  label: () => string;
  icon: AppNavIcon;
};

function navItem(
  id: ShellModuleId,
  to: string,
  match: string,
  label: () => string,
  icon: AppNavIcon,
): AppNavItem {
  return { id, to, match, label, icon };
}

/** 全部 Shell 模块（Rail / 设置页顺序） */
export function appNavItems(): AppNavItem[] {
  return [
    navItem(
      "chat",
      "/chat",
      "/chat",
      shellNavLabel(() => "聊天室"),
      MessageSquare,
    ),
    navItem(
      "rooms",
      "/rooms",
      "/rooms",
      shellNavLabel(() => "群聊"),
      Users,
    ),
    navItem(
      "tasks",
      "/tasks",
      "/tasks",
      shellNavLabel(() => "✅ 清单"),
      ListTodo,
    ),
    navItem(
      "projects",
      "/projects",
      "/projects",
      shellNavLabel(() => "📁 项目"),
      FolderKanban,
    ),
    navItem(
      "objectives",
      "/objectives",
      "/objectives",
      shellNavLabel(() => "目标"),
      Target,
    ),
    navItem(
      "calendar",
      "/calendar",
      "/calendar",
      shellNavLabel(() => "日程"),
      CalendarDays,
    ),
    navItem(
      "pomodoro",
      "/pomodoro",
      "/pomodoro",
      shellNavLabel(() => "🍅 番茄钟"),
      Timer,
    ),
    navItem(
      "email",
      "/email",
      "/email",
      shellNavLabel(() => "📧 邮件"),
      Mail,
    ),
    navItem(
      "diary",
      "/diary",
      "/diary",
      shellNavLabel(() => "📔 日记"),
      BookOpen,
    ),
    navItem(
      "notes",
      "/note",
      "/note",
      shellNavLabel(() => "笔记本"),
      StickyNote,
    ),
    navItem(
      "bookmarks",
      "/bookmarks",
      "/bookmarks",
      shellNavLabel(() => "书签"),
      Bookmark,
    ),
    navItem(
      "health",
      "/health",
      "/health",
      shellNavLabel(() => "健康"),
      HeartPulse,
    ),
    navItem(
      "contacts",
      "/contacts",
      "/contacts",
      shellNavLabel(() => "通讯录"),
      ContactRound,
    ),
    navItem(
      "entity",
      "/entity",
      "/entity",
      shellNavLabel(() => "📦 实体"),
      Boxes,
    ),
    navItem(
      "vault",
      "/vault",
      "/vault",
      shellNavLabel(() => "🔐 凭证库"),
      Lock,
    ),
    navItem(
      "notifications",
      "/notifications",
      "/notifications",
      shellNavLabel(() => "通知"),
      Bell,
    ),
    navItem(
      "bedroom",
      "/bedroom/self-layer",
      "/bedroom",
      shellNavLabel(() => "卧室"),
      Eye,
    ),
    navItem(
      "habitat",
      "/habitat/dashboard",
      "/habitat",
      shellNavLabel(() => "栖息地"),
      LayoutDashboard,
    ),
    navItem(
      "settings",
      "/settings",
      "/settings",
      shellNavLabel(() => "设置"),
      Settings,
    ),
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
