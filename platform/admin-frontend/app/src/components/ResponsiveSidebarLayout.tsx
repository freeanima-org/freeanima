import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { m } from "@admin/lib/i18n.ts";

const MOBILE_LAYOUT_MQ = "(max-width: 1023px)";

function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_LAYOUT_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}

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
  const mobileLayout = useMobileLayout();
  const nativeShell =
    typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
  const useDrawerNav = nativeShell || mobileLayout;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const closeSidebar = () => setSidebarOpen(false);
  const barTitle = headerTitle ?? title;

  return (
    <div className="admin-app h-full flex flex-col min-h-0">
      <header
        className={`shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-200 ${useDrawerNav ? "" : "hidden"}`}
      >
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
        {sidebarOpen && useDrawerNav ? (
          <div className="safe-fixed-overlay z-30 bg-black/50" onClick={closeSidebar} aria-hidden />
        ) : null}

        <aside
          className={[
            "shrink-0 w-64 flex flex-col border-r border-base-300 bg-base-200/30 min-h-0",
            useDrawerNav
              ? sidebarOpen
                ? "safe-fixed-sidebar z-40 flex"
                : "hidden"
              : "relative flex",
          ].join(" ")}
        >
          {showSidebarHeader ? (
            <div
              className={`p-3 font-semibold text-sm text-base-content/60 uppercase tracking-wide shrink-0 ${useDrawerNav ? "hidden" : ""}`}
            >
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
