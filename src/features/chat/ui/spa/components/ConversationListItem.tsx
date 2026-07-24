import { useRef, type ReactElement } from "react";
import { ContextMenu, useLongPress } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import type { ConversationListItem as ConversationListEntry } from "@freeanima/features/chat/ui/spa/lib/types.ts";

type ConversationListItemProps = {
  conversation: ConversationListEntry;
  label: string;
  active: boolean;
  faded?: boolean;
  unread?: boolean;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems: ActionSheetItem[];
  onNavigate: (conversationId: string) => void;
  onOpenMenu: (conversationId: string) => void;
};

export function ConversationListItem({
  conversation,
  label,
  active,
  faded = false,
  unread = false,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
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

  const row: ReactElement = (
    <div
      className={[
        "session-item group flex min-h-10 items-center gap-1",
        active ? "sidebar-nav-active" : "",
        faded ? "opacity-60" : "",
      ].join(" ")}
      onClick={handleClick}
      {...(useActionSheet ? longPress : {})}
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

  if (contextMenuEnabled && !useActionSheet && contextMenuItems.length > 0) {
    return <ContextMenu items={contextMenuItems}>{row}</ContextMenu>;
  }
  return row;
}
