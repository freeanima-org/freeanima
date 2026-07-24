import { Link, useRouterState } from "@tanstack/react-router";
import { BrandLogo, cn } from "@freeanima/frontend/ui-kit";
import {
  useShellModuleVisibility,
  useShellModuleOrder,
} from "@freeanima/frontend/portal-sdk/react.tsx";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { orderedVisibleAppNavItems, type AppNavItem } from "../lib/app-nav-i18n.ts";
import {
  readAppRailExpanded,
  subscribeAppRailExpanded,
  writeAppRailExpanded,
} from "../lib/app-rail-prefs.ts";
import { m as shellMessages } from "@paraglide/messages";
import { AppNavUnreadBadge } from "./AppNavUnreadBadge.tsx";

function useAppRailExpanded(): [boolean, () => void] {
  const expanded = useSyncExternalStore(subscribeAppRailExpanded, readAppRailExpanded, () => false);
  const toggle = useCallback(() => writeAppRailExpanded(!readAppRailExpanded()), []);
  return [expanded, toggle];
}

function useNavActive(match: string): boolean {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith(match);
}

function RailNavLink({ item, expanded }: { item: AppNavItem; expanded: boolean }) {
  const active = useNavActive(item.match);
  const Icon = item.icon;
  const label = item.label();

  return (
    <Link
      to={item.to}
      className={cn(
        "app-rail-nav-item hover:bg-accent hover:text-accent-foreground",
        active && "bg-secondary font-semibold",
      )}
      aria-label={expanded ? undefined : label}
      title={expanded ? undefined : label}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative inline-flex shrink-0">
        <Icon className="app-rail-nav-icon" aria-hidden />
        <AppNavUnreadBadge moduleId={item.id} />
      </span>
      <span className="app-rail-nav-label">{label}</span>
    </Link>
  );
}

export function AppModuleRail() {
  const [expanded, toggleExpanded] = useAppRailExpanded();
  const visible = useShellModuleVisibility();
  const order = useShellModuleOrder();
  const nav = orderedVisibleAppNavItems(visible, order);

  return (
    <aside
      className="app-module-rail shrink-0 border-r border-border bg-muted text-foreground"
      aria-label="模块导航"
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="app-rail-brand">
        <BrandLogo size={22} />
        <span className="app-rail-brand-label">{shellMessages.habitat_brand()}</span>
      </div>

      <nav className="app-rail-nav">
        {nav.map((item) => (
          <RailNavLink key={item.to} item={item} expanded={expanded} />
        ))}
      </nav>

      <div className="app-rail-footer">
        <button
          type="button"
          className="app-rail-nav-item app-rail-toggle text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={expanded ? "收起侧栏" : "展开侧栏"}
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          {expanded ? (
            <PanelLeftClose className="app-rail-nav-icon" aria-hidden />
          ) : (
            <PanelLeft className="app-rail-nav-icon" aria-hidden />
          )}
          <span className="app-rail-nav-label">收起</span>
        </button>
      </div>
    </aside>
  );
}
