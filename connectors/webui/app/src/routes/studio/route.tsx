import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout.tsx";

const CHROMELESS_KEY = "studio-chromeless";

const navItems = [
  { to: "/studio/pair-programming", label: "🤝 结对编程" },
  { to: "/studio/novel", label: "📖 长篇小说创作", comingSoon: true },
  { to: "/studio/short-video", label: "🎬 短视频创作", comingSoon: true },
] as const;

export const Route = createFileRoute("/studio")({
  component: StudioLayout,
});

function StudioLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPairProgramming = pathname.includes("/studio/pair-programming");
  const [chromeless, setChromeless] = useState(false);

  useEffect(() => {
    try {
      setChromeless(localStorage.getItem(CHROMELESS_KEY) === "1");
    } catch {
      setChromeless(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("studio-chromeless", isPairProgramming && chromeless);
  }, [isPairProgramming, chromeless]);

  const toggleChromeless = () => {
    setChromeless((v) => {
      const next = !v;
      try {
        localStorage.setItem(CHROMELESS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (isPairProgramming) {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 flex items-center gap-2 px-2 py-1 border-b border-base-300 bg-base-200/80 text-sm">
          <div className="dropdown">
            <button type="button" tabIndex={0} className="btn btn-ghost btn-xs gap-1">
              🤝 结对编程
              <span className="opacity-50">▾</span>
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu z-50 mt-1 p-1 shadow-lg bg-base-200 rounded-lg w-48 border border-base-300"
            >
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm" activeProps={{ className: "active" }}>
                    {item.label}
                    {"comingSoon" in item && item.comingSoon ? (
                      <span className="badge badge-xs badge-ghost ml-1">即将推出</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            title={chromeless ? "显示顶栏" : "专注模式"}
            onClick={toggleChromeless}
          >
            {chromeless ? "⊞" : "⛶"}
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <ResponsiveSidebarLayout
        title="创作室"
        subtitle="Studio"
        sidebar={() => (
          <nav className="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="nav-link"
                activeProps={{ className: "nav-link sidebar-nav-active" }}
              >
                {item.label}
                {"comingSoon" in item && item.comingSoon ? (
                  <span className="ml-1 badge badge-xs badge-ghost">即将推出</span>
                ) : null}
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
