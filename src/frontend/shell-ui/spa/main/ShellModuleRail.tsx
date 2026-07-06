import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@freeanima/ui-kit";
import { Button } from "@freeanima/ui-kit";
import { useShellModuleVisibility } from "@freeanima/shell-sdk/react";

import { filterVisibleNavItems, shellNavItems, type ShellNavItem } from "../lib/shell-nav-i18n.ts";

type ShellModuleRailProps = {
  activeMatch: (match: string) => boolean;
  footer?: React.ReactNode;
};

function RailNavLink({ item, active }: { item: ShellNavItem; active: boolean }) {
  const Icon = item.icon;
  const label = item.label();
  return (
    <Button
      asChild
      size="icon"
      variant={active ? "secondary" : "ghost"}
      className={active ? "relative" : undefined}
      title={label}
    >
      <Link to={item.to} aria-label={label} aria-current={active ? "page" : undefined}>
        <Icon className="size-5" aria-hidden />
      </Link>
    </Button>
  );
}

export function ShellModuleRail({ activeMatch, footer }: ShellModuleRailProps) {
  const visible = useShellModuleVisibility();
  const nav = filterVisibleNavItems(shellNavItems(), visible);

  return (
    <aside
      className="shell-module-rail flex w-[var(--shell-rail-w)] shrink-0 flex-col items-center gap-1 border-r border-border bg-muted py-2"
      aria-label="模块导航"
    >
      <div className="mb-2 flex shrink-0 items-center justify-center px-1">
        <BrandLogo size={22} />
      </div>
      <nav className="flex w-full flex-col items-center gap-0.5 px-1">
        {nav.map((item) => (
          <RailNavLink key={item.to} item={item} active={activeMatch(item.match)} />
        ))}
      </nav>
      <div className="mt-auto flex w-full flex-col items-center gap-2 px-1 pb-1">{footer}</div>
    </aside>
  );
}
