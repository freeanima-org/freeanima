import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { HubConnectionBanner } from "@/components/HubConnectionBanner.tsx";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout.tsx";
import { useHubRestConnectivity } from "@/hooks/useHubRestConnectivity.ts";
import { adminNavItems } from "@/lib/admin-nav.ts";
import { resetApiClientCache } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar")({
  component: AdminLayout,
});

function AdminLayout() {
  const shell = window.satelliteShell;
  const probeEnabled = Boolean(shell?.isNativeShell || shell?.isElectron);
  const { state, retry } = useHubRestConnectivity(probeEnabled);

  useEffect(() => {
    if (!shell?.listenConfigChanged) return;
    return shell.listenConfigChanged(() => {
      resetApiClientCache();
      void retry();
    });
  }, [shell, retry]);

  return (
    <div data-testid="admin-layout" className="h-full min-h-0 flex flex-col">
      {probeEnabled ? <HubConnectionBanner state={state} onRetry={() => void retry()} /> : null}
      <div className="flex-1 min-h-0">
        <ResponsiveSidebarLayout
          title={m.admin_title()}
          subtitle={m.admin_nav()}
          sidebar={() => (
            <nav className="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
              {adminNavItems().map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="nav-link"
                  activeProps={{ className: "nav-link sidebar-nav-active" }}
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
