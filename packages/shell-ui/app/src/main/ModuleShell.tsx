import { Link, Outlet } from "@tanstack/react-router";
import { detectPlatform } from "../platform.ts";

const NAV = [
  { to: "/chat", label: "聊天室" },
  { to: "/admin", label: "管理台" },
  { to: "/settings", label: "设置" },
] as const;

export function ModuleShell() {
  const platform = detectPlatform();

  return (
    <div className="h-full flex flex-col bg-base-100 text-base-content">
      <header className="navbar bg-base-200 border-b border-base-300 min-h-12 px-3 shrink-0">
        <div className="font-semibold text-sm">FreeAnima</div>
        <nav className="flex gap-1 ml-4">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="btn btn-ghost btn-sm"
              activeProps={{ className: "btn btn-ghost btn-sm btn-active" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main
        className={`flex-1 min-h-0 ${platform === "mobile" ? "pb-[env(safe-area-inset-bottom)]" : ""}`}
      >
        <Outlet />
      </main>
    </div>
  );
}
