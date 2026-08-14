import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";

import { Button } from "@freeanima/ui-kit";
import { ListRow } from "@freeanima/ui-kit/composite";
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
  onArchive: (conversationId: string) => void;
  onUnarchive: (conversationId: string) => void;
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
  onArchive,
  onUnarchive,
}: ConversationListItemProps) {
  const archived = conversation.archivedAt != null;
  const archiveLabel = archived ? "取消归档" : "归档";

  return (
    <ListRow
      as="div"
      selected={active}
      selectedClassName="bg-primary/20 text-foreground font-semibold border-l-[3px] border-l-primary"
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      longPressEnabled={useActionSheet}
      showPersistentMenu={false}
      onLongPress={() => onOpenMenu(conversation.id)}
      onOpenMenu={() => onOpenMenu(conversation.id)}
      className={[
        "gap-1 px-3 py-2 text-sm",
        active ? "" : "text-muted-foreground",
        faded ? "opacity-60" : "",
      ].join(" ")}
      onClick={() => onNavigate(conversation.id)}
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
      {useActionSheet ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={archiveLabel}
          title={archiveLabel}
          onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
          onClick={(e: ReactMouseEvent) => {
            e.stopPropagation();
            if (archived) onUnarchive(conversation.id);
            else onArchive(conversation.id);
          }}
        >
          {archived ? (
            <ArchiveRestoreIcon className="size-4" />
          ) : (
            <ArchiveIcon className="size-4" />
          )}
        </Button>
      ) : null}
    </ListRow>
  );
}
