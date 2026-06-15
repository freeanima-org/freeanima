import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout.tsx";
import { m } from "@/lib/i18n.ts";

const PAIR_PROGRAMMING_URL =
  typeof window !== "undefined"
    ? (localStorage.getItem("pair-programming-url") ?? "http://127.0.0.1:4173")
    : "http://127.0.0.1:4173";

function studioNavItems(): Array<
  { to: string; label: string; comingSoon?: boolean } | { href: string; label: string }
> {
  return [
    { href: PAIR_PROGRAMMING_URL, label: m.webui_studio_nav_pair() },
    { to: "/studio/novel", label: m.webui_studio_nav_novel(), comingSoon: true },
    { to: "/studio/short-video", label: m.webui_studio_nav_short_video(), comingSoon: true },
  ];
}

export const Route = createFileRoute("/studio")({
  component: StudioLayout,
});

function StudioLayout() {
  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <ResponsiveSidebarLayout
        title={m.webui_studio_title()}
        subtitle="Studio"
        sidebar={() => (
          <nav className="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
            {studioNavItems().map((item) =>
              "href" in item ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="nav-link block"
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className="nav-link"
                  activeProps={{ className: "nav-link sidebar-nav-active" }}
                >
                  {item.label}
                  {"comingSoon" in item && item.comingSoon ? (
                    <span className="ml-1 badge badge-xs badge-ghost">
                      {m.webui_common_coming_soon()}
                    </span>
                  ) : null}
                </Link>
              ),
            )}
          </nav>
        )}
      >
        <Outlet />
      </ResponsiveSidebarLayout>
    </div>
  );
}
