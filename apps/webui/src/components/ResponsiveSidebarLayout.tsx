import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

type ResponsiveSidebarLayoutProps = {
  title: string;
  subtitle?: string;
  showSidebarHeader?: boolean;
  children: ReactNode;
  sidebar: (ctx: { close: () => void }) => ReactNode;
  mobileActions?: ReactNode;
};

export function ResponsiveSidebarLayout({
  title,
  subtitle,
  showSidebarHeader = true,
  children,
  sidebar,
  mobileActions,
}: ResponsiveSidebarLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0 relative">
      <div className="lg:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-200">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          aria-expanded={sidebarOpen}
          aria-label="切换导航"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{title}</div>
          {subtitle ? (
            <div className="text-xs text-base-content/50 truncate">{subtitle}</div>
          ) : null}
        </div>
        {mobileActions}
      </div>

      {sidebarOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={closeSidebar}
          aria-hidden
        />
      ) : null}

      <aside
        className={[
          "bg-base-200 flex flex-col shrink-0 border-base-300 z-40",
          "lg:relative lg:w-56 lg:border-r lg:translate-x-0",
          sidebarOpen
            ? "fixed inset-y-0 left-0 w-[min(85vw,16rem)] border-r shadow-xl"
            : "max-lg:hidden",
        ].join(" ")}
      >
        {showSidebarHeader ? (
          <div className="p-3 font-semibold text-sm text-base-content/60 uppercase tracking-wide">
            {title}
            {subtitle ? (
              <span className="block text-xs font-normal normal-case tracking-normal mt-0.5">
                {subtitle}
              </span>
            ) : null}
          </div>
        ) : null}
        {sidebar({ close: closeSidebar })}
      </aside>

      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto app-main-padding">{children}</div>
    </div>
  );
}
