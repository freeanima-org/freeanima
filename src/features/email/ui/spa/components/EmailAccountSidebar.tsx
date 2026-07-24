import type { ReactElement } from "react";
import { Button } from "@freeanima/ui-kit";
import { ContextMenu, EmptyState } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { m } from "@paraglide/messages";
import { Inbox, MoreHorizontal, Plus, Send } from "lucide-react";

import type { EmailAccountRow } from "../lib/api.ts";

export type EmailMailboxFolder = "inbox" | "sent";

function accountLabel(account: EmailAccountRow): string {
  return account.display_name || account.address;
}

type EmailAccountSidebarProps = {
  accounts: EmailAccountRow[];
  activeAccountId: number | null;
  activeFolder: EmailMailboxFolder;
  writesDisabled: boolean;
  useActionSheet: boolean;
  contextMenuEnabled?: boolean;
  contextMenuItemsForAccount?: (account: EmailAccountRow) => ActionSheetItem[];
  onSelectFolder: (account: EmailAccountRow, folder: EmailMailboxFolder) => void;
  onAdd: () => void;
  onEdit: (account: EmailAccountRow) => void;
  onOpenMenu: (account: EmailAccountRow) => void;
};

export function EmailAccountSidebar({
  accounts,
  activeAccountId,
  activeFolder,
  writesDisabled,
  useActionSheet,
  contextMenuEnabled = false,
  contextMenuItemsForAccount,
  onSelectFolder,
  onAdd,
  onEdit,
  onOpenMenu,
}: EmailAccountSidebarProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Button
          type="button"
          size="sm"
          className="h-8 flex-1"
          disabled={writesDisabled}
          onClick={onAdd}
        >
          <Plus className="mr-1 size-3.5" />
          {m.email_add_account()}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          message={m.habitat_email_no_accounts()}
          className="items-start p-2 text-left text-sm"
        />
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => {
            const selected = activeAccountId === account.id;
            const menuItems = contextMenuItemsForAccount?.(account) ?? [];
            const header: ReactElement = (
              <div className="group mb-1 flex items-center gap-1 px-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                  onDoubleClick={useActionSheet ? undefined : () => onEdit(account)}
                  title={account.address}
                >
                  {accountLabel(account)}
                </button>
                {useActionSheet ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex min-h-9 min-w-9 shrink-0 items-center justify-center"
                    aria-label={m.email_account_actions()}
                    disabled={writesDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMenu(account);
                    }}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                ) : null}
              </div>
            );
            return (
              <li key={account.id} className={account.enabled ? "" : "opacity-60"}>
                {contextMenuEnabled && !useActionSheet && menuItems.length > 0 ? (
                  <ContextMenu items={menuItems}>{header}</ContextMenu>
                ) : (
                  header
                )}
                <ul className="space-y-0.5 pl-1">
                  <li>
                    <button
                      type="button"
                      className={`hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                        selected && activeFolder === "inbox"
                          ? "bg-primary/10 ring-primary/30 ring-1 ring-inset"
                          : ""
                      }`}
                      onClick={() => onSelectFolder(account, "inbox")}
                    >
                      <Inbox className="size-3.5 shrink-0 opacity-70" />
                      {m.email_inbox_title()}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                        selected && activeFolder === "sent"
                          ? "bg-primary/10 ring-primary/30 ring-1 ring-inset"
                          : ""
                      }`}
                      onClick={() => onSelectFolder(account, "sent")}
                    >
                      <Send className="size-3.5 shrink-0 opacity-70" />
                      {m.email_sent_title()}
                    </button>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
