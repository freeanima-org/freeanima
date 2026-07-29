import type { ReactElement } from "react";
import { SubjectScopeToggle } from "@freeanima/client/portal-sdk/react.tsx";
import { Button } from "@freeanima/ui-kit";
import { ContextMenu, EmptyState } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { m } from "@paraglide/messages";
import { FileText, Folder, Inbox, MoreHorizontal, Plus, Send, Trash2 } from "lucide-react";

import type { EmailAccountRow, EmailMailboxInfo } from "../lib/api.ts";

function accountLabel(account: EmailAccountRow): string {
  return account.display_name || account.address;
}

function mailboxRole(box: EmailMailboxInfo): string | undefined {
  const flags = (box.special_use ?? []).map((f) => f.toLowerCase());
  if (flags.some((f) => f.includes("inbox"))) return "inbox";
  if (flags.some((f) => f.includes("sent"))) return "sent";
  if (flags.some((f) => f.includes("draft"))) return "drafts";
  if (flags.some((f) => f.includes("trash") || f.includes("deleted"))) return "trash";
  const path = box.path.toLowerCase();
  if (path === "inbox") return "inbox";
  if (path.includes("sent")) return "sent";
  if (path.includes("draft")) return "drafts";
  if (path.includes("trash") || path.includes("deleted")) return "trash";
  return undefined;
}

function mailboxIcon(role: string | undefined) {
  switch (role) {
    case "inbox":
      return Inbox;
    case "sent":
      return Send;
    case "drafts":
      return FileText;
    case "trash":
      return Trash2;
    default:
      return Folder;
  }
}

function mailboxLabel(box: EmailMailboxInfo): string {
  const role = mailboxRole(box);
  if (role === "inbox") return m.email_inbox_title();
  if (role === "sent") return m.email_sent_title();
  if (role === "drafts") return m.email_drafts_title();
  if (role === "trash") return m.email_trash_title();
  return box.name || box.path;
}

const ROLE_ORDER = ["inbox", "sent", "drafts", "trash"];

export function sortMailboxes(boxes: EmailMailboxInfo[]): EmailMailboxInfo[] {
  return boxes.toSorted((a, b) => {
    const ra = mailboxRole(a);
    const rb = mailboxRole(b);
    const ia = ra ? ROLE_ORDER.indexOf(ra) : 99;
    const ib = rb ? ROLE_ORDER.indexOf(rb) : 99;
    if (ia !== ib) return ia - ib;
    return a.path.localeCompare(b.path);
  });
}

export function isSystemMailbox(box: EmailMailboxInfo): boolean {
  const role = mailboxRole(box);
  return role === "inbox" || role === "sent" || role === "drafts" || role === "trash";
}

type EmailAccountSidebarProps = {
  accounts: EmailAccountRow[];
  activeAccountId: number | null;
  mailboxes: EmailMailboxInfo[];
  activeMailbox: string | null;
  writesDisabled: boolean;
  useActionSheet: boolean;
  contextMenuEnabled?: boolean;
  contextMenuItemsForAccount?: (account: EmailAccountRow) => ActionSheetItem[];
  folderMenuItems?: (account: EmailAccountRow, mailbox: EmailMailboxInfo) => ActionSheetItem[];
  onSelectMailbox: (account: EmailAccountRow, mailbox: string) => void;
  onAddAccount: () => void;
  onEditAccount: (account: EmailAccountRow) => void;
  onOpenAccountMenu: (account: EmailAccountRow) => void;
  onNewFolder: (account: EmailAccountRow) => void;
  onOpenFolderMenu?: (account: EmailAccountRow, mailbox: EmailMailboxInfo) => void;
};

export function EmailAccountSidebar({
  accounts,
  activeAccountId,
  mailboxes,
  activeMailbox,
  writesDisabled,
  useActionSheet,
  contextMenuEnabled = false,
  contextMenuItemsForAccount,
  folderMenuItems,
  onSelectMailbox,
  onAddAccount,
  onEditAccount,
  onOpenAccountMenu,
  onNewFolder,
  onOpenFolderMenu,
}: EmailAccountSidebarProps) {
  const sorted = activeAccountId != null ? sortMailboxes(mailboxes) : ([] as EmailMailboxInfo[]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <div className="mb-2 flex justify-center px-1">
        <SubjectScopeToggle />
      </div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Button
          type="button"
          size="sm"
          className="h-8 flex-1"
          disabled={writesDisabled}
          onClick={onAddAccount}
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
                  onDoubleClick={useActionSheet ? undefined : () => onEditAccount(account)}
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
                      onOpenAccountMenu(account);
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
                {selected ? (
                  <ul className="space-y-0.5 pl-1">
                    {sorted.length === 0 ? (
                      <li className="text-muted-foreground px-2 py-1 text-xs">
                        {m.email_no_mailbox_hint()}
                      </li>
                    ) : null}
                    {sorted.map((box) => {
                      const Icon = mailboxIcon(mailboxRole(box));
                      const active = activeMailbox === box.path;
                      const fItems = folderMenuItems?.(account, box) ?? [];
                      const row = (
                        <div className="group/folder flex items-center gap-0.5">
                          <button
                            type="button"
                            className={`hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                              active ? "bg-primary/10 ring-primary/30 ring-1 ring-inset" : ""
                            }`}
                            onClick={() => onSelectMailbox(account, box.path)}
                          >
                            <Icon className="size-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{mailboxLabel(box)}</span>
                          </button>
                          {fItems.length > 0 && useActionSheet ? (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground flex min-h-8 min-w-8 shrink-0 items-center justify-center"
                              aria-label={m.email_folder_rename()}
                              onClick={() => onOpenFolderMenu?.(account, box)}
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      );
                      return (
                        <li key={box.path}>
                          {contextMenuEnabled && !useActionSheet && fItems.length > 0 ? (
                            <ContextMenu items={fItems}>{row}</ContextMenu>
                          ) : (
                            row
                          )}
                        </li>
                      );
                    })}
                    <li>
                      <button
                        type="button"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs"
                        disabled={writesDisabled}
                        onClick={() => onNewFolder(account)}
                      >
                        <Plus className="size-3.5 shrink-0" />
                        {m.email_folder_new()}
                      </button>
                    </li>
                  </ul>
                ) : (
                  <button
                    type="button"
                    className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => onSelectMailbox(account, "INBOX")}
                  >
                    {m.email_inbox_title()}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
