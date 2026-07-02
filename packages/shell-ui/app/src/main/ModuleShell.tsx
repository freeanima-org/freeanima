import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BrandLockup } from "@freeanima/ui-kit";
import { Button } from "@freeanima/ui-kit";
import { SubjectScopeProvider, SubjectToggle, useSubjectScope } from "@freeanima/shell-sdk/react";

import { isCompactLayout, useLayoutMode } from "../layout-mode.ts";
import { navigateShellModule } from "../shell-nav.ts";
import { ShellConnectivityBar } from "../ShellConnectivityBar.tsx";
import {
  shellMobileMoreNavItems,
  shellMobilePrimaryNavItems,
  shellNavItems,
  type ShellNavItem,
} from "../lib/shell-nav-i18n.ts";
import * as shellMessages from "../../../../../messages/paraglide/messages.js";

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function ShellSubjectToggle() {
  const { kind, setKind } = useSubjectScope();
  return <SubjectToggle value={kind} onChange={setKind} />;
}

function ShellNavLink({
  to,
  match,
  label,
  layout,
}: {
  to: string;
  match: string;
  label: () => string;
  layout: "top" | "bottom";
}) {
  const active = useNavActive(match);

  if (layout === "top") {
    return (
      <Button asChild size="sm" variant={active ? "secondary" : "ghost"}>
        <Link to={to} aria-current={active ? "page" : undefined}>
          {label()}
        </Link>
      </Button>
    );
  }

  return (
    <Link
      to={to}
      className={`shell-bottom-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 min-h-12 text-xs transition-colors ${
        active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="leading-none">{label()}</span>
    </Link>
  );
}

function DesktopModuleShell() {
  const nav = shellNavItems();
  return (
    <div className="shell-module-layout h-full flex flex-col bg-background text-foreground">
      <header className="shell-top-nav flex items-center bg-muted border-b border min-h-12 px-3 shrink-0 relative z-50">
        <BrandLockup name={shellMessages.admin_brand()} logoSize={22} className="shrink-0" />
        <nav className="flex gap-1 ml-4 flex-1" aria-label="模块导航">
          {nav.map((item) => (
            <ShellNavLink key={item.to} {...item} layout="top" />
          ))}
        </nav>
        <ShellSubjectToggle />
      </header>
      <ShellConnectivityBar />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
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
            {items.map((item) => (
              <button
                key={item.to}
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                onPointerDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigateShellModule(navigate, item.to);
                  setOpen(false);
                }}
              >
                {item.label()}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MobileModuleShell() {
  const primary = shellMobilePrimaryNavItems();
  const more = shellMobileMoreNavItems();

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
        {primary.map((item) => (
          <ShellNavLink key={item.to} {...item} layout="bottom" />
        ))}
        <MoreNavMenu items={more} />
      </nav>
    </div>
  );
}

export function ModuleShell() {
  const layoutMode = useLayoutMode();
  return (
    <SubjectScopeProvider>
      {isCompactLayout(layoutMode) ? <MobileModuleShell /> : <DesktopModuleShell />}
    </SubjectScopeProvider>
  );
}
