import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SubjectScopeProvider } from "@freeanima/frontend/shell-sdk/react.tsx";
import {
  resolveDefaultVisibleModulePath,
  resolveShellModuleIdFromPath,
} from "@freeanima/frontend/shell-sdk/shell-module-visibility";
import { useShellModuleVisibility } from "@freeanima/frontend/shell-sdk/react.tsx";

import { isCompactLayout, useLayoutMode } from "../layout-mode.ts";
import { navigateShellModule } from "../shell-nav.ts";
import { ShellConnectivityBar } from "../ShellConnectivityBar.tsx";
import { filterVisibleNavItems, shellNavItems, type ShellNavItem } from "../lib/shell-nav-i18n.ts";
import { useShellBottomNavLayout } from "../lib/use-shell-bottom-nav-layout.ts";
import { ShellModuleRail } from "./ShellModuleRail.tsx";
import { PomodoroShellWatcher } from "@freeanima/features/pomodoro/ui/spa/PomodoroShellWatcher.tsx";

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function ShellModuleVisibilityGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const visible = useShellModuleVisibility();

  useEffect(() => {
    const moduleId = resolveShellModuleIdFromPath(pathname);
    if (!moduleId || visible.has(moduleId)) return;
    navigateShellModule(navigate, resolveDefaultVisibleModulePath(visible));
  }, [navigate, pathname, visible]);

  return null;
}

function ShellBottomNavLink({ item }: { item: ShellNavItem }) {
  const active = useNavActive(item.match);
  const Icon = item.icon;
  const label = item.label();

  return (
    <Link
      to={item.to}
      className={`shell-bottom-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 min-h-12 text-xs transition-colors ${
        active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="leading-none truncate max-w-full px-0.5">{label}</span>
    </Link>
  );
}

function MoreNavMenu({ items }: { items: ShellNavItem[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const moreActive = useMemo(
    () => items.some((item) => pathname.startsWith(item.match)),
    [items, pathname],
  );

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center min-h-12">
      <button
        type="button"
        className={`shell-bottom-nav-item flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
          moreActive || open
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="leading-none">More</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[65] cursor-default bg-transparent"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="fixed z-[70] min-w-40 rounded-lg border border bg-background shadow-lg py-1"
            style={{
              right: "max(0.75rem, var(--sar))",
              bottom: "calc(var(--shell-bottom-nav-h) + var(--sab) + 0.5rem)",
            }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigateShellModule(navigate, item.to);
                    setOpen(false);
                  }}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {item.label()}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function DesktopModuleShell() {
  return (
    <div className="shell-module-layout h-full flex flex-row bg-background text-foreground">
      <ShellModuleRail />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ShellConnectivityBar />
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MobileModuleShell() {
  const visible = useShellModuleVisibility();
  const navItems = useMemo(() => filterVisibleNavItems(shellNavItems(), visible), [visible]);
  const { bar, more } = useShellBottomNavLayout(navItems);

  return (
    <div className="shell-module-layout shell-layout-compact h-full flex flex-col bg-background text-foreground">
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ShellConnectivityBar />
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </main>
      <nav
        className="shell-bottom-nav relative z-[60] shrink-0 flex border-t border bg-background safe-area-pb"
        aria-label="模块导航"
      >
        {bar.map((item) => (
          <ShellBottomNavLink key={item.to} item={item} />
        ))}
        {more.length > 0 ? <MoreNavMenu items={more} /> : null}
      </nav>
    </div>
  );
}

export function ModuleShell() {
  const layoutMode = useLayoutMode();
  return (
    <SubjectScopeProvider>
      <ShellModuleVisibilityGuard />
      <PomodoroShellWatcher />
      {isCompactLayout(layoutMode) ? <MobileModuleShell /> : <DesktopModuleShell />}
    </SubjectScopeProvider>
  );
}
