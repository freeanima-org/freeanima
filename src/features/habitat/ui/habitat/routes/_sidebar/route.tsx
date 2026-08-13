import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { isPackagedShell } from "@freeanima/client/portal-sdk/shell-runtime.ts";
import { HabitatConnectionBanner } from "@freeanima/features/habitat/ui/habitat/components/HabitatConnectionBanner.tsx";
import { ResponsiveSidebarLayout } from "@freeanima/features/habitat/ui/habitat/components/ResponsiveSidebarLayout.tsx";
import { useHabitatRpcConnectivity } from "@freeanima/features/habitat/ui/habitat/hooks/useHabitatRpcConnectivity.ts";
import {
  habitatNavGroups,
  habitatNavItems,
} from "@freeanima/features/habitat/ui/habitat/lib/habitat-nav.ts";
import { resetApiClientCache } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";

export const Route = createFileRoute("/_sidebar")({
  component: HabitatLayout,
});

function HabitatSidebarNav() {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1 pb-3 min-h-0 space-y-3">
      {habitatNavGroups().map((group) => (
        <div key={group.id}>
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="session-item"
                activeProps={{ className: "session-item sidebar-nav-active" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function HabitatLayout() {
  const shell = window.portalShell;
  const probeEnabled = isPackagedShell();
  const { state, retry } = useHabitatRpcConnectivity(probeEnabled);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerTitle = useMemo(() => {
    const items = habitatNavItems();
    const active = items
      .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
      .toSorted((a, b) => b.to.length - a.to.length)[0];
    return active?.label ?? "栖息地";
  }, [pathname]);

  useEffect(() => {
    if (!shell?.listenConfigChanged) return () => {};
    return shell.listenConfigChanged(() => {
      resetApiClientCache();
      void retry();
    });
  }, [shell, retry]);

  return (
    <div data-testid="console-layout" className="h-full min-h-0 flex flex-col overflow-x-hidden">
      {probeEnabled ? <HabitatConnectionBanner state={state} onRetry={() => void retry()} /> : null}
      <div className="flex-1 min-h-0">
        <ResponsiveSidebarLayout
          title={"栖息地"}
          headerTitle={headerTitle}
          showSidebarHeader={false}
          sidebar={() => <HabitatSidebarNav />}
        >
          <Outlet />
        </ResponsiveSidebarLayout>
      </div>
    </div>
  );
}
