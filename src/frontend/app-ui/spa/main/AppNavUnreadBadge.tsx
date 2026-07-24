import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";
import type { ShellModuleId } from "@freeanima/frontend/portal-sdk/shell-module-visibility";

function formatBadgeCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

/** Chat 模块导航角标（用户未读会话数） */
export function AppNavUnreadBadge({ moduleId }: { moduleId: ShellModuleId }) {
  const count = useChatUnreadStore((s) => s.unreadConversationCount);
  if (moduleId !== "chat" || count <= 0) return null;
  return (
    <span
      className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
      aria-label={`${count} 个未读会话`}
    >
      {formatBadgeCount(count)}
    </span>
  );
}
