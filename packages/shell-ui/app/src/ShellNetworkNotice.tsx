import * as m from "../../../../messages/paraglide/messages.js";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { useOfflineReadOnly } from "@freeanima/shell-sdk/react";

export function ShellNetworkNotice(): JSX.Element | null {
  const offlineReadOnly = useOfflineReadOnly();
  if (!offlineReadOnly) return null;

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <StatusAlert variant="warning">
        <div className="flex flex-col gap-1">
          <span>{m.ui_network_offline()}</span>
          <span className="text-xs opacity-90">{m.ui_offline_readonly_mode()}</span>
        </div>
      </StatusAlert>
    </div>
  );
}
