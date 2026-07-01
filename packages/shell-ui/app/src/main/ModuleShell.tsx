import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@freeanima/ui-kit";
import { SubjectScopeProvider, SubjectToggle, useSubjectScope } from "@freeanima/shell-sdk/react";

import { detectLayoutMode, isCompactLayout } from "../layout-mode.ts";
import {
  shellMobileMoreNavItems,
  shellMobilePrimaryNavItems,
  shellNavItems,
  type ShellNavItem,
} from "../lib/shell-nav-i18n.ts";

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
        <div className="font-semibold text-sm">FreeAnima</div>
        <nav className="flex gap-1 ml-4 flex-1" aria-label="模块导航">
          {nav.map((item) => (
            <ShellNavLink key={item.to} {...item} layout="top" />
          ))}
        </nav>
        <ShellSubjectToggle />
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function MoreNavMenu({ items }: { items: ShellNavItem[] }) {
  const [open, setOpen] = useState(false);
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
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute bottom-full mb-2 right-0 z-50 min-w-40 rounded-lg border border bg-muted shadow-lg py-1"
          >
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                className="block px-4 py-2 text-sm hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {item.label()}
              </Link>
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
    <div className="shell-module-layout h-full flex flex-col bg-background text-foreground">
      <header className="shell-top-nav flex items-center justify-end bg-muted border-b border min-h-10 px-3 shrink-0">
        <ShellSubjectToggle />
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
      <nav
        className="shell-bottom-nav shrink-0 flex border-t border bg-muted/95 backdrop-blur-sm safe-area-pb"
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
  const layoutMode = detectLayoutMode();
  return (
    <SubjectScopeProvider>
      {isCompactLayout(layoutMode) ? <MobileModuleShell /> : <DesktopModuleShell />}
    </SubjectScopeProvider>
  );
}
