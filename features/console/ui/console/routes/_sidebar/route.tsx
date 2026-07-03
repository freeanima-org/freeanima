import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { BrandLockup } from "@freeanima/ui-kit";
import { HubConnectionBanner } from "@console/components/HubConnectionBanner.tsx";
import { ResponsiveSidebarLayout } from "@console/components/ResponsiveSidebarLayout.tsx";
import { useHubRestConnectivity } from "@console/hooks/useHubRestConnectivity.ts";
import { consoleNavGroups, consoleNavItems } from "@console/lib/console-nav.ts";
import { resetApiClientCache } from "@console/lib/api.ts";
import { m } from "@console/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar")({
  component: ConsoleLayout,
});

function ConsoleSidebarNav() {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1 pb-3 min-h-0 space-y-3">
      {consoleNavGroups().map((group) => (
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

function ConsoleLayout() {
  const shell = window.satelliteShell;
  const probeEnabled = Boolean(shell?.isNativeShell || shell?.isElectron);
  const { state, retry } = useHubRestConnectivity(probeEnabled);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerTitle = useMemo(() => {
    const items = consoleNavItems();
    const active = items
      .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
      .toSorted((a, b) => b.to.length - a.to.length)[0];
    return active?.label ?? m.console_title();
  }, [pathname]);

  useEffect(() => {
    if (!shell?.listenConfigChanged) return;
    return shell.listenConfigChanged(() => {
      resetApiClientCache();
      void retry();
    });
  }, [shell, retry]);

  return (
    <div data-testid="console-layout" className="h-full min-h-0 flex flex-col overflow-x-hidden">
      {probeEnabled ? <HubConnectionBanner state={state} onRetry={() => void retry()} /> : null}
      <div className="flex-1 min-h-0">
        <ResponsiveSidebarLayout
          title={<BrandLockup name={m.console_brand()} subtitle={m.console_nav()} logoSize={22} />}
          headerTitle={headerTitle}
          sidebar={() => <ConsoleSidebarNav />}
        >
          <Outlet />
        </ResponsiveSidebarLayout>
      </div>
    </div>
  );
}
