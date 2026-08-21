import { Link, useRouterState } from "@tanstack/react-router";
import { BrandLogo, cn } from "@freeanima/ui-kit";
import {
  useShellModuleVisibility,
  useShellModuleOrder,
} from "@freeanima/client/portal-sdk/react.tsx";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { orderedVisibleAppNavItems, type AppNavItem } from "../lib/app-nav-i18n.ts";
import {
  readAppRailExpanded,
  subscribeAppRailExpanded,
  writeAppRailExpanded,
} from "../lib/app-rail-prefs.ts";
import { AppNavUnreadBadge } from "./AppNavUnreadBadge.tsx";
import {
  AppNavPomodoroCollapsedClock,
  useAppNavPomodoroDisplayLabel,
} from "./AppNavPomodoroCountdown.tsx";
import { ShellQuickRailSection } from "./ShellQuickNav.tsx";

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
  const fallback = item.label();
  const { label, ariaLabel, hasActive } = useAppNavPomodoroDisplayLabel(
    item.id,
    fallback,
    "expanded",
  );

  return (
    <Link
      to={item.to}
      className={cn(
        "app-rail-nav-item",
        /* 侧栏底为 muted，secondary/accent 与之同色，改用 background / foreground 透明度 */
        active
          ? "bg-background font-semibold text-foreground"
          : "hover:bg-foreground/5 hover:text-foreground",
        !expanded && hasActive && "app-rail-nav-item--pomodoro-active",
      )}
      aria-label={expanded ? undefined : ariaLabel}
      title={expanded ? undefined : ariaLabel}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative inline-flex shrink-0 flex-col items-center">
        <Icon className="app-rail-nav-icon" aria-hidden />
        <AppNavUnreadBadge moduleId={item.id} />
        {!expanded ? <AppNavPomodoroCollapsedClock moduleId={item.id} /> : null}
      </span>
      <span className={cn("app-rail-nav-label", hasActive && "tabular-nums")}>{label}</span>
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
        <span className="app-rail-brand-label">{"逸灵风"}</span>
      </div>

      <nav className="app-rail-nav">
        {nav.map((item) => (
          <RailNavLink key={item.to} item={item} expanded={expanded} />
        ))}
      </nav>

      <ShellQuickRailSection expanded={expanded} />

      <div className="app-rail-footer">
        <button
          type="button"
          className="app-rail-nav-item app-rail-toggle text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
