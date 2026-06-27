import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { HubConnectionBanner } from "@admin/components/HubConnectionBanner.tsx";
import { ResponsiveSidebarLayout } from "@admin/components/ResponsiveSidebarLayout.tsx";
import { useHubRestConnectivity } from "@admin/hooks/useHubRestConnectivity.ts";
import { adminNavItems } from "@admin/lib/admin-nav.ts";
import { resetApiClientCache } from "@admin/lib/api.ts";
import { m } from "@admin/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar")({
  component: AdminLayout,
});

function AdminLayout() {
  const shell = window.satelliteShell;
  const probeEnabled = Boolean(shell?.isNativeShell || shell?.isElectron);
  const { state, retry } = useHubRestConnectivity(probeEnabled);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerTitle = useMemo(() => {
    const items = adminNavItems();
    const active = items
      .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
      .toSorted((a, b) => b.to.length - a.to.length)[0];
    return active?.label ?? m.admin_title();
  }, [pathname]);

  useEffect(() => {
    if (!shell?.listenConfigChanged) return;
    return shell.listenConfigChanged(() => {
      resetApiClientCache();
      void retry();
    });
  }, [shell, retry]);

  return (
    <div data-testid="admin-layout" className="h-full min-h-0 flex flex-col overflow-x-hidden">
      {probeEnabled ? <HubConnectionBanner state={state} onRetry={() => void retry()} /> : null}
      <div className="flex-1 min-h-0">
        <ResponsiveSidebarLayout
          title={m.admin_title()}
          headerTitle={headerTitle}
          subtitle={m.admin_nav()}
          sidebar={() => (
            <nav className="flex-1 overflow-y-auto px-2 py-1 pb-3 space-y-1 min-h-0">
              {adminNavItems().map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="session-item"
                  activeProps={{ className: "session-item sidebar-nav-active" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        >
          <Outlet />
        </ResponsiveSidebarLayout>
      </div>
    </div>
  );
}
