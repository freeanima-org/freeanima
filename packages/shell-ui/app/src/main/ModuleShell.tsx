import { Link, Outlet, useRouterState } from "@tanstack/react-router";

const NAV = [
  { to: "/chat", label: "聊天室", match: "/chat" },
  { to: "/tasks", label: "任务", match: "/tasks" },
  { to: "/notifications", label: "通知", match: "/notifications" },
  { to: "/admin/dashboard", label: "管理台", match: "/admin" },
  { to: "/settings", label: "设置", match: "/settings" },
] as const;

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function ShellNavLink({
  to,
  match,
  label,
  layout,
}: {
  to: string;
  match: string;
  label: string;
  layout: "top" | "bottom";
}) {
  const active = useNavActive(match);

  if (layout === "top") {
    return (
      <Link
        to={to}
        className={`btn btn-ghost btn-sm ${active ? "btn-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      className={`shell-bottom-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 min-h-12 text-xs transition-colors ${
        active ? "text-primary font-semibold" : "text-base-content/60 hover:text-base-content"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export function ModuleShell() {
  return (
    <div className="shell-module-layout h-full flex flex-col bg-base-100 text-base-content">
      <header className="shell-top-nav hidden lg:flex navbar bg-base-200 border-b border-base-300 min-h-12 px-3 shrink-0 relative z-50">
        <div className="font-semibold text-sm">FreeAnima</div>
        <nav className="flex gap-1 ml-4" aria-label="模块导航">
          {NAV.map((item) => (
            <ShellNavLink key={item.to} {...item} layout="top" />
          ))}
        </nav>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>

      <nav
        className="shell-bottom-nav lg:hidden shrink-0 flex border-t border-base-300 bg-base-200/95 backdrop-blur-sm safe-area-pb"
        aria-label="模块导航"
      >
        {NAV.map((item) => (
          <ShellNavLink key={item.to} {...item} layout="bottom" />
        ))}
      </nav>
    </div>
  );
}
