import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { m } from "@admin/lib/i18n.ts";

type ResponsiveSidebarLayoutProps = {
  title: string;
  /** 移动端顶栏标题（默认与聊天室一致：当前页名称） */
  headerTitle?: string;
  subtitle?: string;
  showSidebarHeader?: boolean;
  children: ReactNode;
  sidebar: (ctx: { close: () => void }) => ReactNode;
  mobileActions?: ReactNode;
};

export function ResponsiveSidebarLayout({
  title,
  headerTitle,
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
  const barTitle = headerTitle ?? title;

  return (
    <div className="admin-app h-full flex flex-col min-h-0">
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-200 lg:hidden">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          aria-expanded={sidebarOpen}
          aria-label={m.admin_common_toggle_nav()}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <span className="text-sm font-medium truncate min-w-0">{barTitle}</span>
        <span className="flex-1" />
        {mobileActions}
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen ? (
          <div
            className="lg:hidden safe-fixed-overlay z-30 bg-black/50"
            onClick={closeSidebar}
            aria-hidden
          />
        ) : null}

        <aside
          className={[
            "shrink-0 w-64 flex flex-col border-r border-base-300 bg-base-200/30 min-h-0",
            sidebarOpen ? "safe-fixed-sidebar z-40 lg:static" : "hidden lg:flex",
          ].join(" ")}
        >
          {showSidebarHeader ? (
            <div className="hidden lg:block p-3 font-semibold text-sm text-base-content/60 uppercase tracking-wide shrink-0">
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

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto app-main-padding">{children}</main>
      </div>
    </div>
  );
}
