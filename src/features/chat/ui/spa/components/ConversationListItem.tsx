import { useRef } from "react";
import { useLongPress } from "@freeanima/frontend/ui-kit/composite";
import type { ConversationListItem as ConversationListEntry } from "@freeanima/features/chat/ui/spa/lib/types.ts";

type ConversationListItemProps = {
  conversation: ConversationListEntry;
  label: string;
  active: boolean;
  faded?: boolean;
  unread?: boolean;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  onNavigate: (conversationId: string) => void;
  onOpenMenu: (conversationId: string, coords?: { x: number; y: number }) => void;
};

export function ConversationListItem({
  conversation,
  label,
  active,
  faded = false,
  unread = false,
  useActionSheet,
  contextMenuEnabled,
  onNavigate,
  onOpenMenu,
}: ConversationListItemProps) {
  const suppressClickRef = useRef(false);

  const longPress = useLongPress({
    enabled: useActionSheet,
    onTrigger: () => {
      suppressClickRef.current = true;
      onOpenMenu(conversation.id);
    },
  });

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    void onNavigate(conversation.id);
  };

  return (
    <div
      className={[
        "session-item group flex min-h-10 items-center gap-1",
        active ? "sidebar-nav-active" : "",
        faded ? "opacity-60" : "",
      ].join(" ")}
      onClick={handleClick}
      {...(useActionSheet ? longPress : {})}
      onContextMenu={
        useActionSheet
          ? undefined
          : (e) => {
              if (!contextMenuEnabled) return;
              e.preventDefault();
              e.stopPropagation();
              onOpenMenu(conversation.id, { x: e.clientX, y: e.clientY });
            }
      }
    >
      <div
        className={[
          "min-w-0 flex-1 truncate",
          unread && !active ? "font-semibold text-foreground" : "",
        ].join(" ")}
      >
        {label}
      </div>
      {unread && !active ? (
        <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="未读" title="未读" />
      ) : null}
    </div>
  );
}
