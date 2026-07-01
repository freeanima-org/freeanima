import * as m from "../../../../messages/paraglide/messages.js";
import { StatusAlert } from "@freeanima/ui-kit/composite";

import { useNetworkStatus } from "./use-network-status.ts";

export function ShellNetworkNotice(): JSX.Element | null {
  const online = useNetworkStatus();
  if (online) return null;

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <StatusAlert variant="warning">{m.ui_network_offline()}</StatusAlert>
    </div>
  );
}
