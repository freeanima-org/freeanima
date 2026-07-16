import { Link, useRouterState } from "@tanstack/react-router";
import { BrandLogo, cn } from "@freeanima/frontend/ui-kit";
import {
  useShellModuleVisibility,
  useShellModuleOrder,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { orderedVisibleShellNavItems, type ShellNavItem } from "../lib/shell-nav-i18n.ts";
import {
  readShellRailExpanded,
  subscribeShellRailExpanded,
  writeShellRailExpanded,
} from "../lib/shell-rail-prefs.ts";
import { m as shellMessages } from "@paraglide/messages";

function useShellRailExpanded(): [boolean, () => void] {
  const expanded = useSyncExternalStore(
    subscribeShellRailExpanded,
    readShellRailExpanded,
    () => false,
  );
  const toggle = useCallback(() => writeShellRailExpanded(!readShellRailExpanded()), []);
  return [expanded, toggle];
}

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function RailNavLink({ item, expanded }: { item: ShellNavItem; expanded: boolean }) {
  const active = useNavActive(item.match);
  const Icon = item.icon;
  const label = item.label();

  return (
    <Link
      to={item.to}
      className={cn(
        "shell-rail-nav-item hover:bg-accent hover:text-accent-foreground",
        active && "bg-secondary font-semibold",
      )}
      aria-label={expanded ? undefined : label}
      title={expanded ? undefined : label}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="shell-rail-nav-icon" aria-hidden />
      <span className="shell-rail-nav-label">{label}</span>
    </Link>
  );
}

export function ShellModuleRail() {
  const [expanded, toggleExpanded] = useShellRailExpanded();
  const visible = useShellModuleVisibility();
  const order = useShellModuleOrder();
  const nav = orderedVisibleShellNavItems(visible, order);

  return (
    <aside
      className="shell-module-rail shrink-0 border-r border-border bg-muted text-foreground"
      aria-label="模块导航"
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="shell-rail-brand">
        <BrandLogo size={22} />
        <span className="shell-rail-brand-label">{shellMessages.console_brand()}</span>
      </div>

      <nav className="shell-rail-nav">
        {nav.map((item) => (
          <RailNavLink key={item.to} item={item} expanded={expanded} />
        ))}
      </nav>

      <div className="shell-rail-footer">
        <button
          type="button"
          className="shell-rail-nav-item shell-rail-toggle text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={expanded ? "收起侧栏" : "展开侧栏"}
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          {expanded ? (
            <PanelLeftClose className="shell-rail-nav-icon" aria-hidden />
          ) : (
            <PanelLeft className="shell-rail-nav-icon" aria-hidden />
          )}
          <span className="shell-rail-nav-label">收起</span>
        </button>
      </div>
    </aside>
  );
}
