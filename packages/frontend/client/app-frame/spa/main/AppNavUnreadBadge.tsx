import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";
import { useNotificationUnreadStore } from "@freeanima/features/notification/ui/spa/stores/notification-unread.ts";
import type { ShellModuleId } from "@freeanima/client/portal-sdk/shell-module-visibility";

function formatBadgeCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

/** 模块导航数字角标（Chat 未读会话数 / 通知未读条数） */
export function AppNavUnreadBadge({ moduleId }: { moduleId: ShellModuleId }) {
  const chatCount = useChatUnreadStore((s) => s.unreadConversationCount);
  const notificationCount = useNotificationUnreadStore((s) => s.unreadCount);

  const count =
    moduleId === "chat" ? chatCount : moduleId === "notifications" ? notificationCount : 0;
  if (count <= 0) return null;

  const ariaLabel = moduleId === "chat" ? `${count} 个未读会话` : `${count} 条未读通知`;

  return (
    <span
      className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
      aria-label={ariaLabel}
    >
      {formatBadgeCount(count)}
    </span>
  );
}
