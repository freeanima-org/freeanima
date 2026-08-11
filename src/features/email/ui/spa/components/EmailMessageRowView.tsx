import { Checkbox } from "@freeanima/ui-kit";
import { ListRow } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { m } from "@paraglide/messages";

import type { EmailMessageRow } from "../lib/api.ts";

type EmailMessageRowViewProps = {
  message: EmailMessageRow;
  active: boolean;
  selected: boolean;
  selectionMode: boolean;
  batchBusy: boolean;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems: ActionSheetItem[];
  formatWhen: (iso: string) => string;
  onOpen: () => void;
  onToggleSelect: () => void;
  onOpenMenu: () => void;
};

export function EmailMessageRowView({
  message,
  active,
  selected,
  selectionMode,
  batchBusy,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
  formatWhen,
  onOpen,
  onToggleSelect,
  onOpenMenu,
}: EmailMessageRowViewProps) {
  return (
    <ListRow
      as="div"
      active={active}
      selected={selected || active}
      selectedClassName="bg-primary/10 ring-primary/30 ring-1 ring-inset"
      selectionMode={selectionMode}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      longPressEnabled={useActionSheet}
      onLongPress={onOpenMenu}
      onOpenMenu={onOpenMenu}
      menuAriaLabel={m.email_message_actions()}
      className="w-full items-stretch gap-0 hover:bg-muted/60"
      onClick={() => {
        if (selectionMode) {
          onToggleSelect();
          return;
        }
        onOpen();
      }}
      leading={
        selectionMode ? (
          <label
            className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              isSelected={selected}
              isDisabled={batchBusy}
              onChange={() => onToggleSelect()}
              aria-label={m.email_select_mode()}
            />
          </label>
        ) : undefined
      }
    >
      <div className="min-w-0 flex-1 px-3 py-3 text-left">
        <div className="flex items-start gap-2">
          {message.unread ? (
            <span className="bg-primary mt-1 inline-block h-2 w-2 shrink-0 rounded-full" />
          ) : (
            <span className="mt-1 inline-block h-2 w-2 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className={`truncate ${message.unread ? "font-semibold" : "font-medium"}`}>
              {message.flagged ? "★ " : ""}
              {message.subject || m.habitat_email_no_subject()}
            </div>
            <div className="text-muted-foreground truncate text-xs">
              {message.direction === "outbound" ? message.to : message.from}
            </div>
            <div className="text-muted-foreground mt-1 truncate text-xs">{message.preview}</div>
          </div>
          <div className="text-muted-foreground shrink-0 text-[10px]">
            {formatWhen(message.sent_at)}
          </div>
        </div>
      </div>
    </ListRow>
  );
}
