import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout.tsx";
import { chamberNavItems } from "@/lib/chamber-nav.ts";
import { m } from "@/lib/i18n.ts";

export const Route = createFileRoute("/chamber")({
  component: ChamberLayout,
});

function ChamberLayout() {
  return (
    <div data-testid="chamber-layout" className="h-full min-h-0">
      <ResponsiveSidebarLayout
        title={m.webui_chamber_title()}
        subtitle="Chamber"
        sidebar={() => (
          <nav className="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
            {chamberNavItems().map((item) => (
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
