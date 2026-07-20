import type { MouseEvent } from "react";
import { Button } from "@freeanima/frontend/ui-kit";
import { EmptyState } from "@freeanima/frontend/ui-kit/composite";
import { m } from "@paraglide/messages";
import { MoreHorizontal, Plus } from "lucide-react";

import type { EmailAccountRow } from "../lib/api.ts";

function accountLabel(account: EmailAccountRow): string {
  return account.display_name || account.address;
}

type EmailAccountSidebarProps = {
  accounts: EmailAccountRow[];
  activeAccountId: number | null;
  writesDisabled: boolean;
  useActionSheet: boolean;
  onSelect: (account: EmailAccountRow) => void;
  onAdd: () => void;
  onOpenMenu: (account: EmailAccountRow) => void;
  onOpenContextMenu: (e: MouseEvent, account: EmailAccountRow) => void;
};

export function EmailAccountSidebar({
  accounts,
  activeAccountId,
  writesDisabled,
  useActionSheet,
  onSelect,
  onAdd,
  onOpenMenu,
  onOpenContextMenu,
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
        <ul className="space-y-1">
          {accounts.map((account) => (
            <li key={account.id}>
              <div
                className={`group hover:bg-muted flex w-full items-stretch rounded-lg ${
                  activeAccountId === account.id
                    ? "bg-primary/10 ring-primary/30 ring-1 ring-inset"
                    : ""
                } ${account.enabled ? "" : "opacity-60"}`}
                onContextMenu={(e) => onOpenContextMenu(e, account)}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                  onClick={() => onSelect(account)}
                  onDoubleClick={useActionSheet ? undefined : () => onOpenMenu(account)}
                >
                  <div className="truncate font-medium">{accountLabel(account)}</div>
                  <div className="text-muted-foreground truncate text-xs">{account.address}</div>
                  {!account.enabled ? (
                    <div className="text-muted-foreground text-[10px]">
                      {m.email_account_disabled()}
                    </div>
                  ) : null}
                </button>
                {useActionSheet ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 shrink-0 items-center justify-center"
                    aria-label={m.email_edit_account()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMenu(account);
                    }}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
