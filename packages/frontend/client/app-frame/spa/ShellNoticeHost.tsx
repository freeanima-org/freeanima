import type { ReactNode } from "react";
import { Toaster } from "@freeanima/ui-kit/components/ui/sonner.tsx";

import { OfflineSyncBootstrap } from "./OfflineSyncBootstrap.tsx";
import { ShellConnectivityBar } from "./ShellConnectivityBar.tsx";
import { ShellUpdateBanner } from "./ShellUpdateBanner.tsx";

export function ShellNoticeWatchers(): ReactNode {
  return (
    <>
      <ShellConnectivityBar />
      <ShellUpdateBanner />
      <OfflineSyncBootstrap />
    </>
  );
}

export function ShellToaster(): ReactNode {
  return (
    <Toaster
      position="top-center"
      offset="max(var(--sat), 0.75rem)"
      mobileOffset={{
        top: "max(var(--sat), 0.75rem)",
        bottom: "calc(var(--app-bottom-nav-h, 3rem) + var(--sab, 0px) + 0.75rem)",
      }}
      closeButton
    />
  );
}
