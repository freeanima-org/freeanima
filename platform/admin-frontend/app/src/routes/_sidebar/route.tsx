import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout.tsx";
import { adminNavItems } from "@/lib/admin-nav.ts";
import { m } from "@/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div data-testid="admin-layout" className="h-full min-h-0">
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
  );
}
